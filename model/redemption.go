package model

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/songquanpeng/one-api/common"
	"github.com/songquanpeng/one-api/common/helper"
	"github.com/songquanpeng/one-api/common/logger"
)

const (
	RedemptionCodeStatusEnabled  = 1
	RedemptionCodeStatusDisabled = 2
	RedemptionCodeStatusUsed     = 3
)

// Redemption stores one randomly generated internal code and its quota points.
// Codes do not have user-facing names and are always created one at a time.
type Redemption struct {
	Id           int    `json:"id"`
	UserId       int    `json:"user_id" gorm:"index"`
	Key          string `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status       int    `json:"status" gorm:"default:1;index"`
	Quota        int64  `json:"quota" gorm:"bigint;default:100"`
	CreatedTime  int64  `json:"created_time" gorm:"bigint"`
	RedeemedTime int64  `json:"redeemed_time" gorm:"bigint"`
}

func migrateRedemptionsToQuotaCodes() error {
	if DB.Migrator().HasColumn("redemptions", "name") {
		return DB.Migrator().DropColumn(&Redemption{}, "name")
	}
	return nil
}

func GetAllRedemptions(startIdx int, num int) ([]*Redemption, error) {
	var redemptions []*Redemption
	err := DB.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	return redemptions, err
}

func SearchRedemptions(keyword string) (redemptions []*Redemption, err error) {
	keyColumn := "`key`"
	if common.UsingPostgreSQL {
		keyColumn = `"key"`
	}
	err = DB.Where("id = ?", keyword).Or(keyColumn+" LIKE ?", keyword+"%").
		Order("id desc").Find(&redemptions).Error
	return redemptions, err
}

func GetRedemptionById(id int) (*Redemption, error) {
	if id == 0 {
		return nil, errors.New("兑换码 ID 不能为空")
	}
	redemption := Redemption{Id: id}
	err := DB.First(&redemption, "id = ?", id).Error
	return &redemption, err
}

func Redeem(ctx context.Context, key string, userId int) (quota int64, err error) {
	if key == "" {
		return 0, errors.New("未提供兑换码")
	}
	if userId == 0 {
		return 0, errors.New("无效的用户 ID")
	}
	redemption := &Redemption{}
	keyColumn := "`key`"
	if common.UsingPostgreSQL {
		keyColumn = `"key"`
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where(keyColumn+" = ?", key).First(redemption).Error; err != nil {
			return errors.New("无效的兑换码")
		}
		if redemption.Status != RedemptionCodeStatusEnabled {
			return errors.New("该兑换码已使用或已禁用")
		}
		result := tx.Model(&User{}).Where("id = ? AND status = ?", userId, UserStatusEnabled).
			Update("quota", gorm.Expr("quota + ?", redemption.Quota))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errors.New("兑换用户不存在或已被禁用")
		}
		redemption.RedeemedTime = helper.GetTimestamp()
		redemption.Status = RedemptionCodeStatusUsed
		return tx.Save(redemption).Error
	})
	if err != nil {
		return 0, fmt.Errorf("兑换失败：%w", err)
	}
	if common.RedisEnabled {
		if _, cacheErr := fetchAndUpdateUserQuota(ctx, userId); cacheErr != nil {
			logger.Error(ctx, "failed to refresh user quota cache after redemption: "+cacheErr.Error())
		}
	}
	RecordTopupLog(ctx, userId, fmt.Sprintf("通过兑换码增加 %s", common.LogQuota(redemption.Quota)), redemption.Quota)
	return redemption.Quota, nil
}

func (redemption *Redemption) Insert() error {
	return DB.Create(redemption).Error
}

func (redemption *Redemption) SelectUpdate() error {
	return DB.Model(redemption).Select("redeemed_time", "status").Updates(redemption).Error
}

func (redemption *Redemption) Update() error {
	return DB.Model(redemption).Select("status", "quota", "redeemed_time").Updates(redemption).Error
}

func (redemption *Redemption) Delete() error {
	return DB.Delete(redemption).Error
}

func DeleteRedemptionById(id int) error {
	if id == 0 {
		return errors.New("兑换码 ID 不能为空")
	}
	redemption := Redemption{Id: id}
	if err := DB.Where(redemption).First(&redemption).Error; err != nil {
		return err
	}
	return redemption.Delete()
}
