package model

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/logger"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var monthlyQuotaLocation = time.FixedZone("Asia/Shanghai", 8*60*60)

// MonthlyQuotaGrant guarantees that each enabled non-root user receives at
// most one free quota grant in a calendar month.
type MonthlyQuotaGrant struct {
	Id         int64  `json:"id" gorm:"primaryKey"`
	UserId     int    `json:"user_id" gorm:"uniqueIndex:idx_monthly_grant_user_month"`
	GrantMonth string `json:"grant_month" gorm:"type:char(7);uniqueIndex:idx_monthly_grant_user_month"`
	Quota      int64  `json:"quota" gorm:"bigint;not null"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint;index"`
}

func monthlyGrantMonth(now time.Time) string {
	return now.In(monthlyQuotaLocation).Format("2006-01")
}

func monthlyGrantDescription(now time.Time) string {
	localNow := now.In(monthlyQuotaLocation)
	return fmt.Sprintf("%d年%d月免费额度", localNow.Year(), int(localNow.Month()))
}

// MonthlyQuotaForRole is the free quota issued once per calendar month for a
// normal account role. Administrators use a fixed large balance instead of a
// recurring monthly grant.
func MonthlyQuotaForRole(role int) int64 {
	switch role {
	case RoleStudentUser:
		return config.MonthlyStudentQuota
	case RoleTeacherUser:
		return config.MonthlyTeacherQuota
	default:
		return 0
	}
}

func monthlyQuotaEnabled() bool {
	return config.MonthlyStudentQuota > 0 || config.MonthlyTeacherQuota > 0
}

// GrantMonthlyQuotaForUser grants the configured monthly quota exactly once.
// It returns true only when a new grant was inserted and the account balance
// was increased by this call.
func GrantMonthlyQuotaForUser(ctx context.Context, userId int, now time.Time) (bool, error) {
	if userId <= 0 {
		return false, nil
	}

	var user User
	granted := false
	balanceIncrease := int64(0)
	var grant MonthlyQuotaGrant

	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Select("id", "username", "role", "status").First(&user, userId).Error; err != nil {
			return err
		}
		monthlyQuota := MonthlyQuotaForRole(user.Role)
		if user.Status != UserStatusEnabled || monthlyQuota <= 0 {
			return nil
		}
		grantMonth := monthlyGrantMonth(now)
		existingGrant := MonthlyQuotaGrant{}
		existingErr := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ? AND grant_month = ?", userId, grantMonth).
			First(&existingGrant).Error
		if existingErr == nil {
			if existingGrant.Quota >= monthlyQuota {
				return nil
			}
			balanceIncrease = monthlyQuota - existingGrant.Quota
			if err := tx.Model(&MonthlyQuotaGrant{}).
				Where("id = ?", existingGrant.Id).
				Update("quota", monthlyQuota).Error; err != nil {
				return err
			}
			grant = existingGrant
			grant.Quota = monthlyQuota
		} else if !errors.Is(existingErr, gorm.ErrRecordNotFound) {
			return existingErr
		} else {
			grant = MonthlyQuotaGrant{
				UserId:     userId,
				GrantMonth: grantMonth,
				Quota:      monthlyQuota,
				CreatedAt:  now.Unix(),
			}
			result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&grant)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return nil
			}
			balanceIncrease = monthlyQuota
		}

		result := tx.Model(&User{}).Where("id = ? AND status = ?", userId, UserStatusEnabled).
			Update("quota", gorm.Expr("quota + ?", balanceIncrease))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return fmt.Errorf("monthly quota target user %d is unavailable", userId)
		}
		// The default deployment stores business data and logs in the same
		// database. Write the quota bill in the same transaction so the balance,
		// idempotency marker and bill can never get out of sync.
		if LOG_DB == DB {
			monthlyLog := &Log{
				UserId:    userId,
				Username:  user.Username,
				CreatedAt: now.Unix(),
				Type:      LogTypeSystem,
				Content:   monthlyGrantDescription(now),
				Quota:     balanceIncrease,
			}
			if err := tx.Create(monthlyLog).Error; err != nil {
				return err
			}
		}
		granted = true
		return nil
	})
	if err != nil || !granted {
		return granted, err
	}

	// A separately configured log database cannot participate in the business
	// database transaction, so record it immediately after a successful grant.
	if LOG_DB != nil && LOG_DB != DB {
		RecordSystemQuotaLog(ctx, userId, monthlyGrantDescription(now), balanceIncrease)
	}
	if cacheErr := CacheUpdateUserQuota(ctx, userId); cacheErr != nil {
		logger.Error(ctx, fmt.Sprintf("refresh quota cache for monthly grant user %d failed: %s", userId, cacheErr.Error()))
	}
	return true, nil
}

// GrantMonthlyQuotaForAll catches up every eligible account for the month.
func GrantMonthlyQuotaForAll(ctx context.Context, now time.Time) (int, error) {
	if !monthlyQuotaEnabled() {
		return 0, nil
	}
	var userIds []int
	if err := DB.Model(&User{}).
		Where("status = ? AND role IN ?", UserStatusEnabled, []int{RoleStudentUser, RoleTeacherUser}).
		Pluck("id", &userIds).Error; err != nil {
		return 0, err
	}

	grantedCount := 0
	for _, userId := range userIds {
		granted, err := GrantMonthlyQuotaForUser(ctx, userId, now)
		if err != nil {
			return grantedCount, fmt.Errorf("grant monthly quota for user %d: %w", userId, err)
		}
		if granted {
			grantedCount++
		}
	}
	return grantedCount, nil
}

func nextMonthlyQuotaGrantTime(now time.Time) time.Time {
	localNow := now.In(monthlyQuotaLocation)
	next := time.Date(localNow.Year(), localNow.Month(), 1, 0, 5, 0, 0, monthlyQuotaLocation)
	if !localNow.Before(next) {
		next = next.AddDate(0, 1, 0)
	}
	return next
}

// StartMonthlyQuotaScheduler performs an immediate catch-up and then runs at
// 00:05 on the first day of each month in Asia/Shanghai.
func StartMonthlyQuotaScheduler() {
	if !monthlyQuotaEnabled() {
		logger.SysLog("monthly free quota is disabled")
		return
	}

	run := func(now time.Time) {
		count, err := GrantMonthlyQuotaForAll(context.Background(), now)
		if err != nil {
			logger.SysError("monthly quota grant failed: " + err.Error())
			return
		}
		logger.SysLog(fmt.Sprintf("monthly quota grant checked for %s, newly granted users: %d", monthlyGrantMonth(now), count))
	}

	run(time.Now())
	go func() {
		for {
			next := nextMonthlyQuotaGrantTime(time.Now())
			timer := time.NewTimer(time.Until(next))
			<-timer.C
			run(next)
		}
	}()
}
