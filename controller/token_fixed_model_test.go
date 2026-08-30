//go:build cgo

package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/common/ctxkey"
	"github.com/songquanpeng/one-api/model"
)

func TestAddTokenForcesDeepSeekModelAndKeepsOptionalSubnet(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := useControllerTestDatabase(t, &model.User{}, &model.Token{})
	user := model.User{
		Username: "token-user",
		Password: "test-password-hash",
		Role:     model.RoleStudentUser,
		Status:   model.UserStatusEnabled,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create test user: %v", err)
	}

	router := gin.New()
	router.POST("/token", func(c *gin.Context) {
		c.Set(ctxkey.Id, user.Id)
		AddToken(c)
	})
	request := httptest.NewRequest(http.MethodPost, "/token", bytes.NewBufferString(`{"name":"campus","models":"other-model","subnet":"10.0.0.0/8"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	var body struct {
		Success bool        `json:"success"`
		Message string      `json:"message"`
		Data    model.Token `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !body.Success {
		t.Fatalf("create token failed: %s", body.Message)
	}
	if body.Data.GetModels() != fixedTokenModel {
		t.Fatalf("token models = %q, want %q", body.Data.GetModels(), fixedTokenModel)
	}
	if body.Data.Subnet == nil || *body.Data.Subnet != "10.0.0.0/8" {
		t.Fatalf("token subnet = %v", body.Data.Subnet)
	}

	validated, err := model.ValidateUserToken(body.Data.Key)
	if err != nil {
		t.Fatalf("validate generated token: %v", err)
	}
	if validated.GetModels() != fixedTokenModel {
		t.Fatalf("validated token models = %q, want %q", validated.GetModels(), fixedTokenModel)
	}
}
