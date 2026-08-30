package controller

import (
	"testing"

	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/model"
)

func TestApplyRoleChangeQuotaPreservesExistingAdministratorBalance(t *testing.T) {
	remaining := config.AdministratorQuota - 55
	user := model.User{Role: model.RoleRootUser, Quota: remaining}

	applyRoleChangeQuota(model.RoleRootUser, &user)

	if user.Quota != remaining {
		t.Fatalf("administrator quota = %d, want unchanged value %d", user.Quota, remaining)
	}
}

func TestApplyRoleChangeQuotaInitializesPromotionAndDemotion(t *testing.T) {
	promoted := model.User{Role: model.RoleAdminUser, Quota: 123}
	applyRoleChangeQuota(model.RoleCommonUser, &promoted)
	if promoted.Quota != config.AdministratorQuota {
		t.Fatalf("promoted administrator quota = %d, want %d", promoted.Quota, config.AdministratorQuota)
	}

	demoted := model.User{Role: model.RoleCommonUser, Quota: config.AdministratorQuota}
	applyRoleChangeQuota(model.RoleAdminUser, &demoted)
	want := model.MonthlyQuotaForRole(model.RoleCommonUser)
	if demoted.Quota != want {
		t.Fatalf("demoted user quota = %d, want %d", demoted.Quota, want)
	}
}
