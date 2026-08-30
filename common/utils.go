package common

import (
	"fmt"
)

func LogQuota(quota int64) string {
	return fmt.Sprintf("%d 额度点", quota)
}
