package controller

import (
	"testing"

	"github.com/songquanpeng/one-api/model"
)

func TestGeneratedRedemptionContainsOnlyRandomCodeAndQuota(t *testing.T) {
	first := newGeneratedRedemption(7, 12345)
	second := newGeneratedRedemption(7, 12345)
	if first.UserId != 7 || first.Quota != 12345 || len(first.Key) != 32 {
		t.Fatalf("unexpected generated redemption: %+v", first)
	}
	if first.Key == second.Key {
		t.Fatal("two generated redemption codes are identical")
	}
}

func TestValidateTokenAcceptsCampusSubnetAndFixedModelIsDeepSeek(t *testing.T) {
	subnet := "10.0.0.0/8,192.168.0.0/16"
	if err := validateToken(nil, model.Token{Name: "campus", Subnet: &subnet}); err != nil {
		t.Fatalf("valid campus subnet rejected: %v", err)
	}
	invalidSubnet := "not-a-subnet"
	if err := validateToken(nil, model.Token{Name: "campus", Subnet: &invalidSubnet}); err == nil {
		t.Fatal("invalid subnet was accepted")
	}
	if fixedTokenModel != model.TokenModelDeepSeekV4Flash {
		t.Fatalf("fixed token model = %q", fixedTokenModel)
	}
}
