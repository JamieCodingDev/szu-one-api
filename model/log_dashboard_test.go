//go:build cgo

package model

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/songquanpeng/one-api/common"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestSearchLogsByDayAndModelAggregatesRequestsAndTokens(t *testing.T) {
	oldLogDB := LOG_DB
	oldSQLite := common.UsingSQLite
	oldPostgreSQL := common.UsingPostgreSQL
	oldMySQL := common.UsingMySQL
	databaseName := strings.NewReplacer("/", "-", " ", "-").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", databaseName)), &gorm.Config{})
	if err != nil {
		t.Fatalf("open SQLite test database: %v", err)
	}
	if err = db.AutoMigrate(&Log{}); err != nil {
		t.Fatalf("migrate logs: %v", err)
	}
	LOG_DB = db
	common.UsingSQLite = true
	common.UsingPostgreSQL = false
	common.UsingMySQL = false
	t.Cleanup(func() {
		LOG_DB = oldLogDB
		common.UsingSQLite = oldSQLite
		common.UsingPostgreSQL = oldPostgreSQL
		common.UsingMySQL = oldMySQL
	})

	createdAt := time.Date(2026, 8, 27, 12, 0, 0, 0, time.UTC).Unix()
	logs := []Log{
		{UserId: 7, CreatedAt: createdAt, Type: LogTypeConsume, ModelName: "deepseek-v4-flash", Quota: 140, PromptTokens: 100, CompletionTokens: 20},
		{UserId: 7, CreatedAt: createdAt + 60, Type: LogTypeConsume, ModelName: "deepseek-v4-flash", Quota: 90, PromptTokens: 50, CompletionTokens: 20},
		{UserId: 7, CreatedAt: createdAt + 120, Type: LogTypeTopup, ModelName: "deepseek-v4-flash", Quota: 999, PromptTokens: 999, CompletionTokens: 999},
		{UserId: 8, CreatedAt: createdAt + 180, Type: LogTypeConsume, ModelName: "deepseek-v4-flash", Quota: 999, PromptTokens: 999, CompletionTokens: 999},
		// 20:00 UTC is 04:00 on the next GMT+8 calendar day.
		{UserId: 7, CreatedAt: createdAt + 8*60*60, Type: LogTypeConsume, ModelName: "deepseek-v4-flash", Quota: 12, PromptTokens: 10, CompletionTokens: 1},
	}
	if err = db.Create(&logs).Error; err != nil {
		t.Fatalf("insert logs: %v", err)
	}

	statistics, err := SearchLogsByDayAndModel(7, int(createdAt-60), int(createdAt+9*60*60))
	if err != nil {
		t.Fatalf("aggregate dashboard logs: %v", err)
	}
	if len(statistics) != 2 {
		t.Fatalf("statistics rows = %d, want 2: %+v", len(statistics), statistics)
	}
	got := statistics[0]
	if got.Day != "2026-08-27" || got.ModelName != "deepseek-v4-flash" {
		t.Fatalf("unexpected grouping: %+v", got)
	}
	if got.RequestCount != 2 || got.PromptTokens != 150 || got.CompletionTokens != 40 || got.Quota != 230 {
		t.Fatalf("unexpected aggregate: %+v", got)
	}
	if statistics[1].Day != "2026-08-28" || statistics[1].RequestCount != 1 {
		t.Fatalf("GMT+8 day grouping failed: %+v", statistics[1])
	}
}
