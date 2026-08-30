package model

import "testing"

func TestNormalizeAsAccountCredential(t *testing.T) {
	otherModel := "other-model"
	token := Token{Status: TokenStatusExpired, Models: &otherModel}

	token.NormalizeAsAccountCredential()

	if token.Status != TokenStatusEnabled {
		t.Fatalf("status = %d, want %d", token.Status, TokenStatusEnabled)
	}
	if token.GetModels() != TokenModelDeepSeekV4Flash {
		t.Fatalf("models = %q, want %q", token.GetModels(), TokenModelDeepSeekV4Flash)
	}
}

func TestNormalizeAsAccountCredentialKeepsDisabledStatus(t *testing.T) {
	token := Token{Status: TokenStatusDisabled}

	token.NormalizeAsAccountCredential()

	if token.Status != TokenStatusDisabled {
		t.Fatalf("status = %d, want %d", token.Status, TokenStatusDisabled)
	}
	if token.GetModels() != TokenModelDeepSeekV4Flash {
		t.Fatalf("models = %q, want %q", token.GetModels(), TokenModelDeepSeekV4Flash)
	}
}
