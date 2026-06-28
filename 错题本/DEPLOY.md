# 部署成公开网站

这个项目现在是“静态前端 + Supabase 云端后端”。上线时只需要把当前文件夹部署到静态网站平台，别人访问一个网址即可使用，不需要拷贝项目文件。

## 推荐方式：Vercel

适合长期维护。以后你改代码后，只要重新上传或推送 GitHub，网站会更新。

### 方式 A：直接上传项目文件夹

1. 打开 Vercel 并登录。
2. 使用 Vercel 的 Drop / New Project 上传当前项目文件夹。
3. 如果它要求填写构建设置：
   - Framework Preset：Other
   - Build Command：留空
   - Output Directory：留空或 `.`
4. 部署完成后，Vercel 会给你一个 `https://xxx.vercel.app` 地址。
5. 把这个地址发给别人即可。

### 方式 B：通过 GitHub 自动部署

1. 新建一个 GitHub 仓库。
2. 把当前项目文件推送到仓库。
3. 在 Vercel 选择 Import Git Repository。
4. 构建设置同上：
   - Framework Preset：Other
   - Build Command：留空
   - Output Directory：留空或 `.`
5. 之后每次推送代码到 GitHub，Vercel 会自动更新网站。

## 可选方式：Netlify

1. 打开 Netlify 并登录。
2. 选择 Add new site。
3. 可以直接拖拽整个项目文件夹部署，也可以连接 GitHub 仓库。
4. 构建设置：
   - Build command：留空
   - Publish directory：`.` 
5. 部署完成后，把 Netlify 分配的网址发给别人。

## 可选方式：GitHub Pages

GitHub Pages 也能托管这个项目，但如果以后要自定义域名、预览部署或更方便回滚，Vercel/Netlify 会更省心。

基本流程：

1. 新建 GitHub 仓库并推送当前项目文件。
2. 进入仓库 Settings。
3. 打开 Pages。
4. Source 选择 Deploy from a branch。
5. Branch 选择 `main`，目录选择 `/root`。
6. 保存后等待 GitHub 生成 `https://用户名.github.io/仓库名/`。

## Supabase 上线后必须检查

部署得到正式网址后，进入 Supabase Dashboard：

1. 打开 Authentication。
2. 找到 URL Configuration。
3. Site URL 填你的网站正式地址，例如：

```text
https://your-site.vercel.app
```

4. Redirect URLs 里也加入这个地址。
5. 如果你开启邮箱确认，用户注册后邮件里的确认链接会使用这里的地址。

## 不要公开的内容

当前 `supabase-config.js` 里的 publishable/anon key 可以放在前端。真正不能公开的是 Supabase 的 `service_role` key，不要把它写进任何前端文件或 GitHub 仓库。

数据安全依赖 `supabase-schema.sql` 里的 RLS 策略。上线前确认 SQL 已完整执行，并且 `questions`、`user_settings`、`question-images` 都开启了只允许用户访问自己数据的策略。
