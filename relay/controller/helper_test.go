package controller

import (
	"testing"

	"github.com/songquanpeng/one-api/common/config"
	relaymodel "github.com/songquanpeng/one-api/relay/model"
)

func TestCalculateTextQuotaPoints(t *testing.T) {
	got := calculateTextQuotaPoints(1200, 300)
	want := int64(1800)
	if got != want {
		t.Fatalf("calculateTextQuotaPoints() = %d, want %d", got, want)
	}
}

func TestGetPreConsumedQuotaUsesPointWeights(t *testing.T) {
	originalPreConsumedQuota := config.PreConsumedQuota
	config.PreConsumedQuota = 500
	t.Cleanup(func() {
		config.PreConsumedQuota = originalPreConsumedQuota
	})

	request := &relaymodel.GeneralOpenAIRequest{MaxTokens: 200}
	got := getPreConsumedQuota(request, 100)
	want := int64(1000)
	if got != want {
		t.Fatalf("getPreConsumedQuota() = %d, want %d", got, want)
	}
}
