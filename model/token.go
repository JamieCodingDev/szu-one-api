package model

import (
	"errors"
	"fmt"

	"gorm.io/gorm"

	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/logger"
	"github.com/songquanpeng/one-api/common/message"
)

const (
	TokenStatusEnabled   = 1
	TokenStatusDisabled  = 2
	TokenStatusExpired   = 3 // legacy value, migrated to enabled
	TokenStatusExhausted = 4 // legacy value, migrated to enabled
)

const TokenModelDeepSeekV4Flash = "deepseek-v4-flash"

// Token is only an account credential. Quota and expiry belong to the user
// account, while every token is restricted to DeepSeek V4 Flash.
type Token struct {
	Id           int     `json:"id"`
	UserId       int     `json:"user_id" gorm:"index"`
	Key          string  `json:"key" gorm:"type:char(48);uniqueIndex"`
	Status       int     `json:"status" gorm:"default:1"`
	Name         string  `json:"name" gorm:"index"`
	CreatedTime  int64   `json:"created_time" gorm:"bigint"`
	AccessedTime int64   `json:"accessed_time" gorm:"bigint"`
	Models       *string `json:"models" gorm:"type:text"`
	Subnet       *string `json:"subnet" gorm:"default:''"`
}

func (t *Token) NormalizeAsAccountCredential() {
	if t.Status == TokenStatusExpired || t.Status == TokenStatusExhausted {
		t.Status = TokenStatusEnabled
	}
	if t.GetModels() != TokenModelDeepSeekV4Flash {
		t.Models = stringValuePointer(TokenModelDeepSeekV4Flash)
	}
}

// migrateTokensToAccountCredentials converts legacy per-token quota records
// and then removes columns that are no longer part of this product.
func migrateTokensToAccountCredentials() error {
	if err := DB.Model(&Token{}).
		Where("status IN ?", []int{TokenStatusExpired, TokenStatusExhausted}).
		Update("status", TokenStatusEnabled).Error; err != nil {
		return err
	}
	if err := DB.Model(&Token{}).
		Where("models IS NULL OR models <> ?", TokenModelDeepSeekV4Flash).
		Update("models", TokenModelDeepSeekV4Flash).Error; err != nil {
		return err
	}
	for _, column := range []string{"expired_time", "remain_quota", "unlimited_quota", "used_quota"} {
		if DB.Migrator().HasColumn("tokens", column) {
			if err := DB.Migrator().DropColumn("tokens", column); err != nil {
				return err
			}
		}
	}
	return nil
}

func GetAllUserTokens(userId int, startIdx int, num int, _ string) ([]*Token, error) {
	var tokens []*Token
	err := DB.Where("user_id = ?", userId).
		Order("id desc").Limit(num).Offset(startIdx).Find(&tokens).Error
	return tokens, err
}

func SearchUserTokens(userId int, keyword string) (tokens []*Token, err error) {
	err = DB.Where("user_id = ?", userId).
		Where("name LIKE ?", keyword+"%").Order("id desc").Find(&tokens).Error
	return tokens, err
}

func ValidateUserToken(key string) (token *Token, err error) {
	if key == "" {
		return nil, errors.New("未提供 API 令牌")
	}
	token, err = CacheGetTokenByKey(key)
	if err != nil {
		logger.SysError("CacheGetTokenByKey failed: " + err.Error())
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("无效的 API 令牌")
		}
		return nil, errors.New("API 令牌验证失败")
	}
	token.NormalizeAsAccountCredential()
	if token.Status != TokenStatusEnabled {
		return nil, errors.New("该 API 令牌已被禁用")
	}
	return token, nil
}

func GetTokenByIds(id int, userId int) (*Token, error) {
	if id == 0 || userId == 0 {
		return nil, errors.New("令牌 ID 或用户 ID 不能为空")
	}
	token := Token{Id: id, UserId: userId}
	err := DB.First(&token, "id = ? and user_id = ?", id, userId).Error
	return &token, err
}

func GetTokenById(id int) (*Token, error) {
	if id == 0 {
		return nil, errors.New("令牌 ID 不能为空")
	}
	token := Token{Id: id}
	err := DB.First(&token, "id = ?", id).Error
	return &token, err
}

func (t *Token) Insert() error {
	t.Models = stringValuePointer(TokenModelDeepSeekV4Flash)
	t.NormalizeAsAccountCredential()
	return DB.Create(t).Error
}

func (t *Token) Update() error {
	t.Models = stringValuePointer(TokenModelDeepSeekV4Flash)
	return DB.Model(t).Select("name", "status", "models", "subnet").Updates(t).Error
}

func (t *Token) SelectUpdate() error {
	return DB.Model(t).Select("accessed_time", "status").Updates(t).Error
}

func (t *Token) Delete() error {
	return DB.Delete(t).Error
}

func (t *Token) GetModels() string {
	if t == nil || t.Models == nil {
		return ""
	}
	return *t.Models
}

func stringValuePointer(value string) *string {
	return &value
}

func DeleteTokenById(id int, userId int) error {
	if id == 0 || userId == 0 {
		return errors.New("令牌 ID 或用户 ID 不能为空")
	}
	token := Token{Id: id, UserId: userId}
	if err := DB.Where(token).First(&token).Error; err != nil {
		return err
	}
	return token.Delete()
}

// PreConsumeTokenQuota checks and reserves quota from the shared user account.
func PreConsumeTokenQuota(tokenId int, quota int64) error {
	if quota < 0 {
		return errors.New("额度点不能为负数")
	}
	token, err := GetTokenById(tokenId)
	if err != nil {
		return err
	}
	userQuota, err := GetUserQuota(token.UserId)
	if err != nil {
		return err
	}
	if userQuota < quota {
		return errors.New("账户额度不足")
	}
	quotaTooLow := userQuota >= config.QuotaRemindThreshold && userQuota-quota < config.QuotaRemindThreshold
	noMoreQuota := userQuota-quota <= 0
	if quotaTooLow || noMoreQuota {
		go sendQuotaReminder(token.UserId, userQuota, noMoreQuota)
	}
	return DecreaseUserQuota(token.UserId, quota)
}

func sendQuotaReminder(userId int, quota int64, exhausted bool) {
	email, err := GetUserEmail(userId)
	if err != nil {
		logger.SysError("failed to fetch user quota reminder email: " + err.Error())
		return
	}
	if email == "" {
		return
	}
	state := "即将用尽"
	if exhausted {
		state = "已用尽"
	}
	const subject = "额度提醒"
	content := message.EmailTemplate(subject, fmt.Sprintf(
		"<p>您好，您的账户额度%s，当前剩余 <strong>%d 额度点</strong>。</p><p>本系统不提供付费充值；如有需要请联系管理员。</p>",
		state, quota,
	))
	if err = message.SendEmail(subject, email, content); err != nil {
		logger.SysError("failed to send quota reminder email: " + err.Error())
	}
}

// PostConsumeTokenQuota adjusts only the shared user quota. A token never owns
// a separate quota balance.
func PostConsumeTokenQuota(tokenId int, quota int64) error {
	token, err := GetTokenById(tokenId)
	if err != nil {
		return err
	}
	if quota > 0 {
		return DecreaseUserQuota(token.UserId, quota)
	}
	return IncreaseUserQuota(token.UserId, -quota)
}
