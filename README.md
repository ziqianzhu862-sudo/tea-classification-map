# 茗香万象：中国茶叶分类与产地地图

一个基于中国茶叶分类与产地数据制作的信息可视化网站。

## 内容

- 六大茶类圆环可视化
- 中国茶叶产地连线图
- 四大茶区分布统计
- 省份强度排行
- 茶叶品种搜索与筛选

## 本地预览

```powershell
python -m http.server 5188 --directory D:\Codex\tea-classification-map
```

然后打开：

```text
http://localhost:5188/
```

## 数据来源

数据来自本地整理的《中国茶叶全分类产地对照表.xlsx》，已转换为 `data/tea-data.json` 供前端静态加载。
