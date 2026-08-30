package controller

import (
	"testing"

	"github.com/songquanpeng/one-api/model"
	"github.com/songquanpeng/one-api/relay/channeltype"
)

func TestPrepareDeepSeekV4FlashChannel(t *testing.T) {
	baseURL := "http://llama-server:8080/"
	channel := model.Channel{Key: "local", BaseURL: &baseURL}
	if message := prepareDeepSeekV4FlashChannel(&channel, true); message != "" {
		t.Fatalf("unexpected validation message: %s", message)
	}
	if channel.Type != channeltype.OpenAICompatible {
		t.Fatalf("channel type = %d, want %d", channel.Type, channeltype.OpenAICompatible)
	}
	if channel.Models != deepSeekV4FlashModel {
		t.Fatalf("channel model = %q, want %q", channel.Models, deepSeekV4FlashModel)
	}
	if channel.GetBaseURL() != "http://llama-server:8080/v1" {
		t.Fatalf("base URL = %q", channel.GetBaseURL())
	}
	if channel.Name != "DeepSeek V4 Flash" || channel.Group != "default" {
		t.Fatalf("unexpected defaults: name=%q group=%q", channel.Name, channel.Group)
	}
}

func TestPrepareDeepSeekV4FlashChannelRejectsInvalidConnection(t *testing.T) {
	invalidURL := "llama-server:8080"
	channel := model.Channel{Key: "local", BaseURL: &invalidURL}
	if message := prepareDeepSeekV4FlashChannel(&channel, true); message == "" {
		t.Fatal("expected invalid URL to be rejected")
	}

	validURL := "http://llama-server:8080/v1"
	channel = model.Channel{BaseURL: &validURL}
	if message := prepareDeepSeekV4FlashChannel(&channel, true); message == "" {
		t.Fatal("expected blank API key to be rejected")
	}
}

func TestPrepareDeepSeekV4FlashChannelAllowsPartialStatusUpdate(t *testing.T) {
	channel := model.Channel{Id: 1, Status: model.ChannelStatusEnabled}
	if message := prepareDeepSeekV4FlashChannel(&channel, false); message != "" {
		t.Fatalf("partial update rejected: %s", message)
	}
	if channel.Type != channeltype.OpenAICompatible || channel.Models != deepSeekV4FlashModel {
		t.Fatal("partial update did not enforce the DeepSeek channel type and model")
	}
}
