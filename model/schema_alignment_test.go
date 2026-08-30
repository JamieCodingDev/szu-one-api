//go:build cgo

package model

import (
	"fmt"
	"strings"
	"testing"

	"github.com/songquanpeng/one-api/common"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type legacyTokenSchema struct {
	Id             int `gorm:"primaryKey"`
	UserId         int
	Key            string
	Status         int
	Name           string
	CreatedTime    int64
	AccessedTime   int64
	ExpiredTime    int64
	RemainQuota    int64
	UnlimitedQuota bool
	UsedQuota      int64
	Models         *string
	Subnet         *string
}

func (legacyTokenSchema) TableName() string { return "tokens" }

type legacyRedemptionSchema struct {
	Id           int `gorm:"primaryKey"`
	UserId       int
	Key          string
	Status       int
	Name         string
	Quota        int64
	CreatedTime  int64
	RedeemedTime int64
}

func (legacyRedemptionSchema) TableName() string { return "redemptions" }

type legacyUserSchema struct {
	Id       int `gorm:"primaryKey"`
	Username string
	Group    string
}

func (legacyUserSchema) TableName() string { return "users" }

func TestProductSchemaMigrationRemovesLegacyFieldsAndPreservesRecords(t *testing.T) {
	oldDB := DB
	oldSQLite := common.UsingSQLite
	oldPostgreSQL := common.UsingPostgreSQL
	oldMySQL := common.UsingMySQL
	databaseName := strings.NewReplacer("/", "-", " ", "-").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", databaseName)), &gorm.Config{})
	if err != nil {
		t.Fatalf("open SQLite test database: %v", err)
	}
	if err = db.AutoMigrate(&legacyTokenSchema{}, &legacyRedemptionSchema{}, &legacyUserSchema{}); err != nil {
		t.Fatalf("create legacy schema: %v", err)
	}
	otherModel := "other-model"
	legacyToken := legacyTokenSchema{
		UserId: 1, Key: "legacy-token", Status: TokenStatusExpired, Name: "legacy",
		ExpiredTime: 123, RemainQuota: 456, UsedQuota: 789, Models: &otherModel,
	}
	legacyRedemption := legacyRedemptionSchema{
		UserId: 1, Key: "legacy-redemption", Status: RedemptionCodeStatusEnabled,
		Name: "obsolete", Quota: 321,
	}
	legacyUser := legacyUserSchema{Username: "legacy-user", Group: "legacy-group"}
	if err = db.Create(&legacyToken).Error; err != nil {
		t.Fatalf("insert legacy token: %v", err)
	}
	if err = db.Create(&legacyRedemption).Error; err != nil {
		t.Fatalf("insert legacy redemption: %v", err)
	}
	if err = db.Create(&legacyUser).Error; err != nil {
		t.Fatalf("insert legacy user: %v", err)
	}

	DB = db
	common.UsingSQLite = true
	common.UsingPostgreSQL = false
	common.UsingMySQL = false
	t.Cleanup(func() {
		DB = oldDB
		common.UsingSQLite = oldSQLite
		common.UsingPostgreSQL = oldPostgreSQL
		common.UsingMySQL = oldMySQL
	})

	if err = db.AutoMigrate(&Token{}, &Redemption{}, &User{}); err != nil {
		t.Fatalf("migrate current schema: %v", err)
	}
	if err = migrateTokensToAccountCredentials(); err != nil {
		t.Fatalf("align token schema: %v", err)
	}
	if err = migrateRedemptionsToQuotaCodes(); err != nil {
		t.Fatalf("align redemption schema: %v", err)
	}
	if err = migrateUsersWithoutGroups(); err != nil {
		t.Fatalf("align user schema: %v", err)
	}

	for _, column := range []string{"expired_time", "remain_quota", "unlimited_quota", "used_quota"} {
		if db.Migrator().HasColumn("tokens", column) {
			t.Errorf("legacy token column %q still exists", column)
		}
	}
	if db.Migrator().HasColumn("redemptions", "name") {
		t.Error("legacy redemption name column still exists")
	}
	if db.Migrator().HasColumn("users", "group") {
		t.Error("legacy user group column still exists")
	}

	var token Token
	if err = db.First(&token, legacyToken.Id).Error; err != nil {
		t.Fatalf("load migrated token: %v", err)
	}
	if token.Status != TokenStatusEnabled || token.GetModels() != TokenModelDeepSeekV4Flash {
		t.Fatalf("unexpected migrated token: %+v", token)
	}
	var redemption Redemption
	if err = db.First(&redemption, legacyRedemption.Id).Error; err != nil {
		t.Fatalf("load migrated redemption: %v", err)
	}
	if redemption.Key != legacyRedemption.Key || redemption.Quota != legacyRedemption.Quota {
		t.Fatalf("unexpected migrated redemption: %+v", redemption)
	}
	var user User
	if err = db.First(&user, legacyUser.Id).Error; err != nil {
		t.Fatalf("load migrated user: %v", err)
	}
	if user.Username != legacyUser.Username {
		t.Fatalf("unexpected migrated user: %+v", user)
	}
}
