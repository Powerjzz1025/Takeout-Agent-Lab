# Step 2：外卖 Agent 核心数据结构

这一阶段的目标不是接真实大模型，而是先定义产品内部“怎么表达世界”。后续接入大模型、高德地图 API、真实工具接口时，都围绕这些对象流转。

## 1. UserNeed 用户点餐需求

用户说一句自然语言后，Agent 先把它转成结构化需求。

```json
{
  "rawText": "20 分钟内送到，清淡一点，预算 35 元左右",
  "budget": 35,
  "maxDeliveryMinutes": 20,
  "tasteGoals": ["清淡"],
  "avoidIngredients": [],
  "mealContext": "工作餐",
  "peopleCount": 1,
  "confidence": 0.72,
  "missingSlots": []
}
```

## 2. Restaurant 餐厅

餐厅对象表达“这家店能不能送、值不值得选”。

```json
{
  "id": "r001",
  "name": "青禾轻食研究所",
  "category": "轻食",
  "deliveryMinutes": 18,
  "deliveryFee": 3,
  "rating": 4.8,
  "distanceKm": 1.4,
  "geo": {
    "lng": 121.4737,
    "lat": 31.2304
  },
  "tags": ["清淡", "高蛋白", "低脂", "工作餐"]
}
```

后续接高德地图 API 时，`geo`、`distanceKm`、`deliveryMinutes` 会从真实地图和配送估算中来。

## 3. Dish 菜品

菜品对象表达“这个东西适不适合这次吃”。

```json
{
  "id": "d001",
  "restaurantId": "r001",
  "name": "香煎鸡胸藜麦饭",
  "price": 32,
  "taste": ["清淡", "咸鲜"],
  "tags": ["高蛋白", "低脂", "饱腹"],
  "allergens": [],
  "spicyLevel": 0,
  "available": true
}
```

## 4. UserMemory 长期记忆

长期记忆不是“聊天记录”，而是以后仍然有用的稳定信息。

```json
{
  "id": "m001",
  "type": "preference",
  "content": "用户偏好清淡、少油的工作餐",
  "value": "清淡少油",
  "confidence": 0.8,
  "source": "user_confirmed",
  "updatedAt": "2026-07-07"
}
```

敏感记忆，例如过敏、健康、宗教饮食，必须用户确认后保存。

## 5. Cart 购物车

购物车用于下单前确认，不能让 Agent 自动越过确认。

```json
{
  "restaurantId": "r001",
  "items": [
    {
      "dishId": "d001",
      "name": "香煎鸡胸藜麦饭",
      "quantity": 1,
      "unitPrice": 32
    }
  ],
  "subtotal": 32,
  "deliveryFee": 3,
  "total": 35,
  "status": "draft"
}
```

`status` 一期只允许：`draft`、`needs_confirmation`、`confirmed`。

## 6. ToolCall 工具调用契约

未来真实 Agent 调工具时，统一用这个形状记录。

```json
{
  "id": "tool_001",
  "name": "search_restaurants",
  "input": {
    "keyword": "清淡 工作餐",
    "maxDeliveryMinutes": 20,
    "location": {
      "lng": 121.4737,
      "lat": 31.2304
    }
  },
  "status": "success",
  "outputPreview": "找到 3 家候选商家"
}
```

## 7. 后续真实接口接入计划

### 大模型

后续会新增一个服务端代理，前端不直接暴露 API Key：

- `POST /api/agent/run`
- 输入：用户消息、当前状态、可用工具列表
- 输出：Agent 回复、工具调用轨迹、推荐结果、是否需要用户确认

### 高德地图 API

后续会把当前位置、餐厅位置、距离和预计时间接入真实地图能力：

- 地理编码：把地址转经纬度
- 周边搜索：搜索附近餐厅 POI
- 路径规划/距离估算：辅助判断配送时间

### 真实工具接口

先接 mock，再替换真实服务：

- `search_restaurants`
- `get_menu`
- `rank_dishes`
- `retrieve_food_knowledge`
- `get_user_memory`
- `save_user_memory`
- `create_cart`
- `confirm_order`

