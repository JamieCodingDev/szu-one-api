//go:build cgo

package model

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/songquanpeng/one-api/common"
	"github.com/songquanpeng/one-api/common/config"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupMonthlyQuotaTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	oldDB, oldLogDB := DB, LOG_DB
	oldSQLite := common.UsingSQLite
	oldMySQL := common.UsingMySQL
	oldPostgreSQL := common.UsingPostgreSQL
	oldRedis := common.RedisEnabled
	oldStudentQuota := config.MonthlyStudentQuota
	oldTeacherQuota := config.MonthlyTeacherQuota
	oldAdministratorQuota := config.AdministratorQuota

	databaseName := strings.NewReplacer("/", "-", " ", "-").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", databaseName)), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	if err = db.AutoMigrate(&User{}, &Log{}, &MonthlyQuotaGrant{}); err != nil {
		t.Fatalf("migrate test database: %v", err)
	}
	DB, LOG_DB = db, db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	config.MonthlyStudentQuota = 10_000_000
	config.MonthlyTeacherQuota = 20_000_000
	config.AdministratorQuota = 5_000_000_000_000_000
	t.Cleanup(func() {
		DB, LOG_DB = oldDB, oldLogDB
		common.UsingSQLite = oldSQLite
		common.UsingMySQL = oldMySQL
		common.UsingPostgreSQL = oldPostgreSQL
		common.RedisEnabled = oldRedis
		config.MonthlyStudentQuota = oldStudentQuota
		config.MonthlyTeacherQuota = oldTeacherQuota
		config.AdministratorQuota = oldAdministratorQuota
	})
	return db
}

func TestMonthlyQuotaGrantIsIdempotentAndSkipsIneligibleUsers(t *testing.T) {
	db := setupMonthlyQuotaTestDB(t)
	users := []User{
		{Username: "student", AccessToken: "access-student", AffCode: "aff-student", Role: RoleStudentUser, Status: UserStatusEnabled},
		{Username: "teacher", AccessToken: "access-teacher", AffCode: "aff-teacher", Role: RoleTeacherUser, Status: UserStatusEnabled},
		{Username: "admin", AccessToken: "access-admin", AffCode: "aff-admin", Role: RoleAdminUser, Status: UserStatusEnabled},
		{Username: "disabled", AccessToken: "access-disabled", AffCode: "aff-disabled", Role: RoleStudentUser, Status: UserStatusDisabled},
		{Username: "root", AccessToken: "access-root", AffCode: "aff-root", Role: RoleRootUser, Status: UserStatusEnabled},
	}
	for index := range users {
		if err := db.Create(&users[index]).Error; err != nil {
			t.Fatalf("create user: %v", err)
		}
	}

	now := time.Date(2026, time.September, 1, 0, 5, 0, 0, monthlyQuotaLocation)
	count, err := GrantMonthlyQuotaForAll(context.Background(), now)
	if err != nil || count != 2 {
		t.Fatalf("first monthly grant count=%d err=%v", count, err)
	}
	count, err = GrantMonthlyQuotaForAll(context.Background(), now.Add(12*time.Hour))
	if err != nil || count != 0 {
		t.Fatalf("duplicate monthly grant count=%d err=%v", count, err)
	}

	expectedQuota := map[int]int64{
		users[0].Id: 10_000_000,
		users[1].Id: 20_000_000,
	}
	for _, user := range users[:2] {
		quota, quotaErr := GetUserQuota(user.Id)
		if quotaErr != nil || quota != expectedQuota[user.Id] {
			t.Fatalf("eligible user %s quota=%d want=%d err=%v", user.Username, quota, expectedQuota[user.Id], quotaErr)
		}
	}
	for _, user := range users[2:] {
		quota, quotaErr := GetUserQuota(user.Id)
		if quotaErr != nil || quota != 0 {
			t.Fatalf("ineligible user %s quota=%d err=%v", user.Username, quota, quotaErr)
		}
	}

	var grants int64
	if err = db.Model(&MonthlyQuotaGrant{}).Count(&grants).Error; err != nil || grants != 2 {
		t.Fatalf("monthly grants=%d err=%v", grants, err)
	}
	var bills int64
	if err = db.Model(&Log{}).Where("type = ?", LogTypeSystem).Count(&bills).Error; err != nil || bills != 2 {
		t.Fatalf("monthly bill logs=%d err=%v", bills, err)
	}

	count, err = GrantMonthlyQuotaForAll(context.Background(), now.AddDate(0, 1, 0))
	if err != nil || count != 2 {
		t.Fatalf("next month grant count=%d err=%v", count, err)
	}
	quota, err := GetUserQuota(users[0].Id)
	if err != nil || quota != 20_000_000 {
		t.Fatalf("next month accumulated quota=%d err=%v", quota, err)
	}
	teacherQuota, err := GetUserQuota(users[1].Id)
	if err != nil || teacherQuota != 40_000_000 {
		t.Fatalf("teacher next month accumulated quota=%d err=%v", teacherQuota, err)
	}
}

func TestAdministratorQuotaFloorUsesBigIntSafeValue(t *testing.T) {
	db := setupMonthlyQuotaTestDB(t)
	users := []User{
		{Username: "admin-floor", AccessToken: "access-admin-floor", AffCode: "aff-admin-floor", Role: RoleAdminUser, Status: UserStatusEnabled, Quota: 123},
		{Username: "root-floor", AccessToken: "access-root-floor", AffCode: "aff-root-floor", Role: RoleRootUser, Status: UserStatusEnabled, Quota: 456},
		{Username: "student-floor", AccessToken: "access-student-floor", AffCode: "aff-student-floor", Role: RoleStudentUser, Status: UserStatusEnabled, Quota: 789},
	}
	if err := db.Create(&users).Error; err != nil {
		t.Fatalf("create quota floor users: %v", err)
	}
	if err := EnsureAdministratorQuotaFloor(); err != nil {
		t.Fatalf("ensure administrator quota floor: %v", err)
	}
	for _, user := range users[:2] {
		quota, err := GetUserQuota(user.Id)
		if err != nil || quota != 5_000_000_000_000_000 {
			t.Fatalf("administrator %s quota=%d err=%v", user.Username, quota, err)
		}
	}
	quota, err := GetUserQuota(users[2].Id)
	if err != nil || quota != 789 {
		t.Fatalf("student quota should not be changed: quota=%d err=%v", quota, err)
	}
}

func TestTeacherReceivesOnlyMissingDifferenceFromLegacyMonthlyGrant(t *testing.T) {
	db := setupMonthlyQuotaTestDB(t)
	now := time.Date(2026, time.September, 15, 12, 0, 0, 0, monthlyQuotaLocation)
	teacher := User{
		Username: "legacy-teacher", AccessToken: "access-legacy-teacher", AffCode: "aff-legacy-teacher",
		Role: RoleTeacherUser, Status: UserStatusEnabled, Quota: 10_000_000,
	}
	if err := db.Create(&teacher).Error; err != nil {
		t.Fatalf("create legacy teacher: %v", err)
	}
	legacyGrant := MonthlyQuotaGrant{
		UserId: teacher.Id, GrantMonth: monthlyGrantMonth(now), Quota: 10_000_000, CreatedAt: now.Unix(),
	}
	if err := db.Create(&legacyGrant).Error; err != nil {
		t.Fatalf("create legacy grant: %v", err)
	}

	granted, err := GrantMonthlyQuotaForUser(context.Background(), teacher.Id, now)
	if err != nil || !granted {
		t.Fatalf("top up legacy teacher grant: granted=%v err=%v", granted, err)
	}
	quota, err := GetUserQuota(teacher.Id)
	if err != nil || quota != 20_000_000 {
		t.Fatalf("teacher quota after difference grant=%d err=%v", quota, err)
	}
	if err := db.First(&legacyGrant, legacyGrant.Id).Error; err != nil || legacyGrant.Quota != 20_000_000 {
		t.Fatalf("legacy grant was not upgraded: %+v err=%v", legacyGrant, err)
	}
	var bill Log
	if err := db.Where("user_id = ? AND type = ?", teacher.Id, LogTypeSystem).First(&bill).Error; err != nil || bill.Quota != 10_000_000 {
		t.Fatalf("difference bill mismatch: %+v err=%v", bill, err)
	}
	granted, err = GrantMonthlyQuotaForUser(context.Background(), teacher.Id, now.Add(time.Hour))
	if err != nil || granted {
		t.Fatalf("upgraded grant must remain idempotent: granted=%v err=%v", granted, err)
	}
}

func TestNextMonthlyQuotaGrantTimeUsesAsiaShanghai(t *testing.T) {
	before := time.Date(2026, time.September, 1, 0, 4, 0, 0, monthlyQuotaLocation)
	wantSameMonth := time.Date(2026, time.September, 1, 0, 5, 0, 0, monthlyQuotaLocation)
	if got := nextMonthlyQuotaGrantTime(before); !got.Equal(wantSameMonth) {
		t.Fatalf("next grant before schedule=%s want=%s", got, wantSameMonth)
	}
	after := time.Date(2026, time.September, 1, 0, 6, 0, 0, monthlyQuotaLocation)
	wantNextMonth := time.Date(2026, time.October, 1, 0, 5, 0, 0, monthlyQuotaLocation)
	if got := nextMonthlyQuotaGrantTime(after); !got.Equal(wantNextMonth) {
		t.Fatalf("next grant after schedule=%s want=%s", got, wantNextMonth)
	}
}
