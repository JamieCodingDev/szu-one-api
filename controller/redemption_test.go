//go:build cgo

package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/common"
	"github.com/songquanpeng/one-api/common/ctxkey"
	"github.com/songquanpeng/one-api/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func useControllerTestDatabase(t *testing.T, entities ...interface{}) *gorm.DB {
	t.Helper()
	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldSQLite := common.UsingSQLite
	oldPostgreSQL := common.UsingPostgreSQL
	oldMySQL := common.UsingMySQL
	oldRedis := common.RedisEnabled

	databaseName := strings.NewReplacer("/", "-", " ", "-").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", databaseName)), &gorm.Config{})
	if err != nil {
		t.Fatalf("open SQLite test database: %v", err)
	}
	if err = db.AutoMigrate(entities...); err != nil {
		t.Fatalf("migrate SQLite test database: %v", err)
	}

	model.DB, model.LOG_DB = db, db
	common.UsingSQLite = true
	common.UsingPostgreSQL = false
	common.UsingMySQL = false
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.UsingSQLite = oldSQLite
		common.UsingPostgreSQL = oldPostgreSQL
		common.UsingMySQL = oldMySQL
		common.RedisEnabled = oldRedis
	})
	return db
}

func TestAddRedemptionOnlyNeedsQuotaAndGeneratedCodeCanBeRedeemed(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := useControllerTestDatabase(t, &model.User{}, &model.Redemption{}, &model.Log{})
	user := model.User{
		Username: "redeem-user",
		Password: "test-password-hash",
		Role:     model.RoleStudentUser,
		Status:   model.UserStatusEnabled,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create test user: %v", err)
	}

	router := gin.New()
	router.POST("/redemption", func(c *gin.Context) {
		c.Set(ctxkey.Id, user.Id)
		AddRedemption(c)
	})

	request := httptest.NewRequest(http.MethodPost, "/redemption", bytes.NewBufferString(`{"quota":12345,"name":"客户端名称应被忽略","count":99}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	var body struct {
		Success bool     `json:"success"`
		Message string   `json:"message"`
		Data    []string `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !body.Success || len(body.Data) != 1 {
		t.Fatalf("unexpected create response: success=%v data=%v message=%q", body.Success, body.Data, body.Message)
	}
	if len(body.Data[0]) != 32 {
		t.Fatalf("generated code length = %d, want 32", len(body.Data[0]))
	}

	var stored model.Redemption
	if err := db.First(&stored).Error; err != nil {
		t.Fatalf("load generated redemption: %v", err)
	}
	if stored.Key != body.Data[0] || stored.Quota != 12345 {
		t.Fatalf("unexpected stored redemption: %+v", stored)
	}

	quota, err := model.Redeem(context.Background(), body.Data[0], user.Id)
	if err != nil || quota != 12345 {
		t.Fatalf("redeem generated code: quota=%d err=%v", quota, err)
	}
	var updatedUser model.User
	if err = db.First(&updatedUser, user.Id).Error; err != nil {
		t.Fatalf("load redeemed user: %v", err)
	}
	if updatedUser.Quota != 12345 {
		t.Fatalf("user quota = %d, want 12345", updatedUser.Quota)
	}
	if _, err = model.Redeem(context.Background(), body.Data[0], user.Id); err == nil {
		t.Fatal("the same redemption code was accepted twice")
	}
}
