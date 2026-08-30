package controller

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/ctxkey"
	"github.com/songquanpeng/one-api/common/helper"
	"github.com/songquanpeng/one-api/common/random"
	"github.com/songquanpeng/one-api/model"
)

func newGeneratedRedemption(userID int, quota int64) model.Redemption {
	return model.Redemption{
		UserId:      userID,
		Key:         random.GetUUID(),
		CreatedTime: helper.GetTimestamp(),
		Quota:       quota,
	}
}

func insertGeneratedRedemption(userID int, quota int64) (model.Redemption, error) {
	var redemption model.Redemption
	var err error
	for attempt := 0; attempt < 3; attempt++ {
		redemption = newGeneratedRedemption(userID, quota)
		if err = redemption.Insert(); err == nil {
			return redemption, nil
		}
	}
	return model.Redemption{}, err
}

func GetAllRedemptions(c *gin.Context) {
	p, _ := strconv.Atoi(c.Query("p"))
	if p < 0 {
		p = 0
	}
	redemptions, err := model.GetAllRedemptions(p*config.ItemsPerPage, config.ItemsPerPage)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": redemptions})
}

func SearchRedemptions(c *gin.Context) {
	redemptions, err := model.SearchRedemptions(c.Query("keyword"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": redemptions})
}

func GetRedemption(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	redemption, err := model.GetRedemptionById(id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": redemption})
}

// AddRedemption creates exactly one code. The client only supplies quota points;
// its name and random key are controlled by the server.
func AddRedemption(c *gin.Context) {
	request := model.Redemption{}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	if request.Quota <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "兑换码额度点必须大于 0"})
		return
	}

	redemption, err := insertGeneratedRedemption(c.GetInt(ctxkey.Id), request.Quota)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    []string{redemption.Key},
	})
}

func DeleteRedemption(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := model.DeleteRedemptionById(id); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

func UpdateRedemption(c *gin.Context) {
	statusOnly := c.Query("status_only")
	request := model.Redemption{}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	redemption, err := model.GetRedemptionById(request.Id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	if statusOnly != "" {
		if request.Status != model.RedemptionCodeStatusEnabled && request.Status != model.RedemptionCodeStatusDisabled {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的兑换码状态"})
			return
		}
		redemption.Status = request.Status
	} else {
		if request.Quota <= 0 {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "兑换码额度点必须大于 0"})
			return
		}
		redemption.Quota = request.Quota
	}
	if err = redemption.Update(); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": redemption})
}
