//go:build cgo

package router

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/common"
	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/helper"
	"github.com/songquanpeng/one-api/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type apiEnvelope struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

func setupAPITestRouter(t *testing.T) (*gin.Engine, *gorm.DB, model.User, model.User) {
	t.Helper()
	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldSQLite := common.UsingSQLite
	oldPostgreSQL := common.UsingPostgreSQL
	oldMySQL := common.UsingMySQL
	oldRedis := common.RedisEnabled
	oldDebug := config.DebugEnabled
	databaseName := strings.NewReplacer("/", "-", " ", "-").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", databaseName)), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	if err = db.AutoMigrate(&model.User{}, &model.Token{}, &model.Redemption{}, &model.Log{}, &model.MonthlyQuotaGrant{}); err != nil {
		t.Fatalf("migrate test database: %v", err)
	}
	model.DB, model.LOG_DB = db, db
	common.UsingSQLite = true
	common.UsingPostgreSQL = false
	common.UsingMySQL = false
	common.RedisEnabled = false
	config.DebugEnabled = true
	t.Cleanup(func() {
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.UsingSQLite = oldSQLite
		common.UsingPostgreSQL = oldPostgreSQL
		common.UsingMySQL = oldMySQL
		common.RedisEnabled = oldRedis
		config.DebugEnabled = oldDebug
	})

	rootPassword, _ := common.Password2Hash("root-password")
	studentPassword, _ := common.Password2Hash("student-password")
	root := model.User{
		Username: "root", Password: rootPassword, DisplayName: "Root", Role: model.RoleRootUser,
		Status: model.UserStatusEnabled, AccessToken: "root-access-token", AffCode: "root-aff", Quota: 1000,
	}
	student := model.User{
		Username: "student", Password: studentPassword, DisplayName: "Student", Role: model.RoleStudentUser,
		Status: model.UserStatusEnabled, AccessToken: "student-access-token", AffCode: "student-aff", Quota: 100,
	}
	if err = db.Create(&root).Error; err != nil {
		t.Fatalf("create root: %v", err)
	}
	if err = db.Create(&student).Error; err != nil {
		t.Fatalf("create student: %v", err)
	}

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("test-secret"))))
	SetApiRouter(engine)
	return engine, db, root, student
}

func performAPIRequest(t *testing.T, engine *gin.Engine, method, path, accessToken string, payload interface{}) (*httptest.ResponseRecorder, apiEnvelope) {
	t.Helper()
	var body *bytes.Reader
	if payload == nil {
		body = bytes.NewReader(nil)
	} else {
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal request body: %v", err)
		}
		body = bytes.NewReader(encoded)
	}
	request := httptest.NewRequest(method, path, body)
	request.Header.Set("Content-Type", "application/json")
	if accessToken != "" {
		request.Header.Set("Authorization", accessToken)
	}
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)
	var envelope apiEnvelope
	_ = json.Unmarshal(response.Body.Bytes(), &envelope)
	return response, envelope
}

func TestRegistrationRequiresAndStoresFullSchoolEmail(t *testing.T) {
	engine, db, _, _ := setupAPITestRouter(t)
	oldRegisterEnabled := config.RegisterEnabled
	oldPasswordRegisterEnabled := config.PasswordRegisterEnabled
	oldEmailVerificationEnabled := config.EmailVerificationEnabled
	oldMonthlyStudentQuota := config.MonthlyStudentQuota
	oldMonthlyTeacherQuota := config.MonthlyTeacherQuota
	config.RegisterEnabled = true
	config.PasswordRegisterEnabled = true
	config.EmailVerificationEnabled = false
	config.MonthlyStudentQuota = 10_000_000
	config.MonthlyTeacherQuota = 20_000_000
	t.Cleanup(func() {
		config.RegisterEnabled = oldRegisterEnabled
		config.PasswordRegisterEnabled = oldPasswordRegisterEnabled
		config.EmailVerificationEnabled = oldEmailVerificationEnabled
		config.MonthlyStudentQuota = oldMonthlyStudentQuota
		config.MonthlyTeacherQuota = oldMonthlyTeacherQuota
	})

	_, rejected := performAPIRequest(t, engine, http.MethodPost, "/api/user/register", "", map[string]interface{}{
		"email":    "2510103047",
		"password": "student-password",
	})
	if rejected.Success || !strings.Contains(rejected.Message, "完整") {
		t.Fatalf("student ID without a domain should be rejected clearly: %+v", rejected)
	}

	_, nonNumericAccount := performAPIRequest(t, engine, http.MethodPost, "/api/user/register", "", map[string]interface{}{
		"email":    "student@mails.szu.edu.cn",
		"password": "student-password",
	})
	if nonNumericAccount.Success || !strings.Contains(nonNumericAccount.Message, "数字工号") {
		t.Fatalf("non-numeric school account should be rejected: %+v", nonNumericAccount)
	}

	_, external := performAPIRequest(t, engine, http.MethodPost, "/api/user/register", "", map[string]interface{}{
		"email":    "2510103047@example.com",
		"password": "student-password",
	})
	if external.Success || !strings.Contains(external.Message, "深圳大学") {
		t.Fatalf("external email should be rejected: %+v", external)
	}

	// Different student/staff mailbox subdomains under szu.edu.cn are accepted.
	const schoolEmail = "2510103047@mail.szu.edu.cn"
	_, registered := performAPIRequest(t, engine, http.MethodPost, "/api/user/register", "", map[string]interface{}{
		"email":    schoolEmail,
		"password": "student-password",
	})
	if !registered.Success {
		t.Fatalf("school email registration failed: %s", registered.Message)
	}
	var user model.User
	if err := db.Where("username = ?", schoolEmail).First(&user).Error; err != nil {
		t.Fatalf("load registered student: %v", err)
	}
	if user.Email != schoolEmail || user.DisplayName != "2510103047" || user.Role != model.RoleStudentUser || user.Quota != 10_000_000 {
		t.Fatalf("unexpected registered student: %+v", user)
	}

	_, duplicate := performAPIRequest(t, engine, http.MethodPost, "/api/user/register", "", map[string]interface{}{
		"email":    schoolEmail,
		"password": "another-password",
	})
	if duplicate.Success || !strings.Contains(duplicate.Message, "已经注册") {
		t.Fatalf("duplicate school email should be rejected: %+v", duplicate)
	}
}

func TestCurrentPageAPIsAndPermissions(t *testing.T) {
	engine, db, root, student := setupAPITestRouter(t)

	response, status := performAPIRequest(t, engine, http.MethodGet, "/api/status", "", nil)
	if response.Code != http.StatusOK || !status.Success {
		t.Fatalf("status API failed: code=%d body=%s", response.Code, response.Body.String())
	}

	_, self := performAPIRequest(t, engine, http.MethodGet, "/api/user/self", student.AccessToken, nil)
	if !self.Success {
		t.Fatalf("user self API failed: %s", self.Message)
	}
	_, dashboard := performAPIRequest(t, engine, http.MethodGet, "/api/user/dashboard", student.AccessToken, nil)
	if !dashboard.Success {
		t.Fatalf("dashboard API failed: %s", dashboard.Message)
	}

	_, denied := performAPIRequest(t, engine, http.MethodPost, "/api/redemption/", student.AccessToken, map[string]interface{}{"quota": 123})
	if denied.Success {
		t.Fatal("student unexpectedly created an admin redemption code")
	}

	_, createdCode := performAPIRequest(t, engine, http.MethodPost, "/api/redemption/", root.AccessToken, map[string]interface{}{"quota": 250})
	if !createdCode.Success {
		t.Fatalf("admin redemption creation failed: %s", createdCode.Message)
	}
	var codes []string
	if err := json.Unmarshal(createdCode.Data, &codes); err != nil || len(codes) != 1 {
		t.Fatalf("unexpected redemption payload: %s", string(createdCode.Data))
	}
	_, redeemed := performAPIRequest(t, engine, http.MethodPost, "/api/user/topup", student.AccessToken, map[string]interface{}{"key": codes[0]})
	if !redeemed.Success {
		t.Fatalf("student redemption failed: %s", redeemed.Message)
	}
	_, granted := performAPIRequest(t, engine, http.MethodPost, "/api/topup", root.AccessToken, map[string]interface{}{
		"user_id": student.Id, "quota": 50, "remark": "每月默认额度",
	})
	if !granted.Success {
		t.Fatalf("admin quota grant failed: %s", granted.Message)
	}
	_, billing := performAPIRequest(t, engine, http.MethodGet, "/api/billing/self?p=0", student.AccessToken, nil)
	if !billing.Success {
		t.Fatalf("billing API failed: %s", billing.Message)
	}
	var bills []model.Log
	if err := json.Unmarshal(billing.Data, &bills); err != nil || len(bills) != 2 {
		t.Fatalf("unexpected redemption bill data: %s", string(billing.Data))
	}
	if bills[0].Type != model.LogTypeSystem || bills[1].Type != model.LogTypeTopup {
		t.Fatalf("quota sources were classified incorrectly: %+v", bills)
	}

	_, createdToken := performAPIRequest(t, engine, http.MethodPost, "/api/token/", student.AccessToken, map[string]interface{}{
		"name": "campus", "models": "other-model", "subnet": "10.0.0.0/8",
	})
	if !createdToken.Success {
		t.Fatalf("token creation failed: %s", createdToken.Message)
	}
	var token model.Token
	if err := json.Unmarshal(createdToken.Data, &token); err != nil {
		t.Fatalf("decode token: %v", err)
	}
	if token.GetModels() != model.TokenModelDeepSeekV4Flash {
		t.Fatalf("token model = %q, want %q", token.GetModels(), model.TokenModelDeepSeekV4Flash)
	}
	_, tokenList := performAPIRequest(t, engine, http.MethodGet, "/api/token/?p=0", student.AccessToken, nil)
	if !tokenList.Success {
		t.Fatalf("token list API failed: %s", tokenList.Message)
	}

	_, users := performAPIRequest(t, engine, http.MethodGet, "/api/user/?p=0", root.AccessToken, nil)
	if !users.Success {
		t.Fatalf("admin user list API failed: %s", users.Message)
	}
	var userList []model.User
	if err := json.Unmarshal(users.Data, &userList); err != nil || len(userList) != 2 {
		t.Fatalf("unexpected user list: %s", string(users.Data))
	}
	for _, user := range userList {
		if user.Password != "" || user.AccessToken != "" {
			t.Fatalf("user list leaked credentials for user %s", user.Username)
		}
	}

	_, updated := performAPIRequest(t, engine, http.MethodPut, "/api/user/", root.AccessToken, map[string]interface{}{
		"id": student.Id, "username": student.Username, "display_name": "Updated Student",
		"password": "new-password", "role": model.RoleStudentUser, "status": model.UserStatusEnabled,
		"quota": 0,
	})
	if !updated.Success {
		t.Fatalf("admin user update failed: %s", updated.Message)
	}
	var updatedStudent model.User
	if err := db.First(&updatedStudent, student.Id).Error; err != nil {
		t.Fatalf("load updated student: %v", err)
	}
	if updatedStudent.Quota != 0 || updatedStudent.DisplayName != "Updated Student" ||
		!common.ValidatePasswordAndHash("new-password", updatedStudent.Password) {
		t.Fatalf("admin update did not persist zero quota/password: %+v", updatedStudent)
	}

	consumeLog := model.Log{
		UserId: student.Id, CreatedAt: helper.GetTimestamp(), Type: model.LogTypeConsume,
		ModelName: model.TokenModelDeepSeekV4Flash, TokenName: token.Name,
		PromptTokens: 10, CompletionTokens: 3, Quota: 16,
	}
	if err := db.Create(&consumeLog).Error; err != nil {
		t.Fatalf("insert usage log: %v", err)
	}
	_, usage := performAPIRequest(t, engine, http.MethodGet, "/api/user/dashboard", student.AccessToken, nil)
	if !usage.Success {
		t.Fatalf("usage API failed: %s", usage.Message)
	}
	var usageRows []model.LogStatistic
	if err := json.Unmarshal(usage.Data, &usageRows); err != nil || len(usageRows) != 1 {
		t.Fatalf("unexpected usage data: %s", string(usage.Data))
	}
	if usageRows[0].RequestCount != 1 || usageRows[0].PromptTokens != 10 || usageRows[0].CompletionTokens != 3 || usageRows[0].Quota != 16 {
		t.Fatalf("wrong usage counters: %+v", usageRows[0])
	}
	_, usageDetails := performAPIRequest(t, engine, http.MethodGet, "/api/usage/self?p=0", student.AccessToken, nil)
	if !usageDetails.Success {
		t.Fatalf("usage details API failed: %s", usageDetails.Message)
	}
	var detailRows []model.Log
	if err := json.Unmarshal(usageDetails.Data, &detailRows); err != nil || len(detailRows) != 1 {
		t.Fatalf("unexpected usage details: %s", string(usageDetails.Data))
	}
	if detailRows[0].PromptTokens != 10 || detailRows[0].CompletionTokens != 3 || detailRows[0].Quota != 16 {
		t.Fatalf("wrong usage detail: %+v", detailRows[0])
	}
}
