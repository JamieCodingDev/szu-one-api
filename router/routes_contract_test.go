package router

import (
	"fmt"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/common/config"
)

func TestCurrentProductAPIRoutesAreRegistered(t *testing.T) {
	oldDebug := config.DebugEnabled
	config.DebugEnabled = true
	t.Cleanup(func() { config.DebugEnabled = oldDebug })
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)

	routes := make(map[string]bool)
	for _, route := range engine.Routes() {
		routes[fmt.Sprintf("%s %s", route.Method, route.Path)] = true
	}
	expected := []string{
		"GET /api/status",
		"GET /api/user/dashboard",
		"GET /api/user/self",
		"GET /api/user/",
		"GET /api/user/search",
		"GET /api/user/:id",
		"POST /api/user/",
		"PUT /api/user/",
		"POST /api/user/topup",
		"GET /api/token/",
		"GET /api/token/:id",
		"POST /api/token/",
		"PUT /api/token/",
		"DELETE /api/token/:id",
		"GET /api/redemption/",
		"POST /api/redemption/",
		"PUT /api/redemption/",
		"DELETE /api/redemption/:id",
		"GET /api/billing/self",
		"GET /api/usage/self",
		"POST /api/topup",
	}
	for _, route := range expected {
		if !routes[route] {
			t.Errorf("required API route is missing: %s", route)
		}
	}
	if routes["GET /api/group/"] {
		t.Error("legacy user group API route is still registered")
	}
}
