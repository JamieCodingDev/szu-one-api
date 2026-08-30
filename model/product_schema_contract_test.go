package model

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

func TestProductModelsDoNotExposeLegacyFields(t *testing.T) {
	userType := reflect.TypeOf(User{})
	if _, exists := userType.FieldByName("Group"); exists {
		t.Error("legacy user group field still exists")
	}
	usernameField, exists := userType.FieldByName("Username")
	if !exists || !strings.Contains(usernameField.Tag.Get("gorm"), "type:varchar(50)") {
		t.Errorf("user account database column must be varchar(50), tag=%q", usernameField.Tag.Get("gorm"))
	}
	emailField, exists := userType.FieldByName("Email")
	if !exists || !strings.Contains(emailField.Tag.Get("gorm"), "type:varchar(50)") {
		t.Errorf("user email database column must be varchar(50), tag=%q", emailField.Tag.Get("gorm"))
	}

	tokenType := reflect.TypeOf(Token{})
	for _, field := range []string{"ExpiredTime", "RemainQuota", "UnlimitedQuota", "UsedQuota"} {
		if _, exists := tokenType.FieldByName(field); exists {
			t.Errorf("legacy token field %s still exists", field)
		}
	}
	redemptionType := reflect.TypeOf(Redemption{})
	for _, field := range []string{"Name", "Count"} {
		if _, exists := redemptionType.FieldByName(field); exists {
			t.Errorf("legacy redemption field %s still exists", field)
		}
	}
	logQuotaField, exists := reflect.TypeOf(Log{}).FieldByName("Quota")
	if !exists || logQuotaField.Type.Kind() != reflect.Int64 || !strings.Contains(logQuotaField.Tag.Get("gorm"), "type:bigint") {
		t.Errorf("log quota database column must use int64/bigint, field=%+v", logQuotaField)
	}
}

func TestDashboardStatisticUsesStableJSONFieldNames(t *testing.T) {
	encoded, err := json.Marshal(LogStatistic{
		Day: "2026-08-27", ModelName: TokenModelDeepSeekV4Flash,
		RequestCount: 2, Quota: 230, PromptTokens: 150, CompletionTokens: 40,
	})
	if err != nil {
		t.Fatalf("marshal dashboard statistic: %v", err)
	}
	var body map[string]interface{}
	if err = json.Unmarshal(encoded, &body); err != nil {
		t.Fatalf("decode dashboard statistic: %v", err)
	}
	for _, key := range []string{"day", "model_name", "request_count", "quota", "prompt_tokens", "completion_tokens"} {
		if _, exists := body[key]; !exists {
			t.Errorf("dashboard JSON field %q is missing: %s", key, encoded)
		}
	}
}
