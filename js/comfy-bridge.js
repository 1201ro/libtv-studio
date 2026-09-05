// ==================== ComfyUI 桥接模块 ====================
// 把内置的 Wan2.2 ComfyUI 工作流（UI格式）在运行时转换为 API 格式，
// 通过本地代理提交到用户的 ComfyUI 服务器执行，取回真实生成的视频。
// 依赖 app.js 中的 showToast / sleep（运行时调用，加载顺序无关）。

// 五个内置工作流的元数据（节点 ID 从各工作流文件中核对得出）
const COMFY_MODELS = {
  'wan22-i2v-14b': {
    file: 'wan22-i2v-14b.json', name: 'Wan2.2 图生视频 14B',
    positive: '6', negative: '7', samplers: ['57', '58'], latent: '63', image: '62', save: '61',
    supportsImage: true, fps: 16,
    desc: '双模型(高噪+低噪) 20步 CFG3.5，画质最佳',
  },
  'wan22-i2v-fast': {
    file: 'wan22-i2v-fast.json', name: 'Wan2.2 图生视频 14B 加速',
    positive: '6', negative: '7', samplers: ['57', '58'], latent: '63', image: '62', save: '61',
    supportsImage: true, fps: 16,
    desc: 'Lightx2v 蒸馏LoRA 8步 CFG1 + SageAttention，速度快约5倍',
  },
  'wan22-t2v-14b': {
    file: 'wan22-t2v-14b.json', name: 'Wan2.2 文生视频 14B',
    positive: '6', negative: '7', samplers: ['57', '58'], latent: '59', image: null, save: '61',
    supportsImage: false, fps: 16,
    desc: '纯文字生成，双模型 20步 CFG3.5',
  },
  'wan22-t2v-fast': {
    file: 'wan22-t2v-fast.json', name: 'Wan2.2 文生视频 14B 加速',
    positive: '6', negative: '7', samplers: ['57', '58'], latent: '59', image: null, save: '61',
    supportsImage: false, fps: 16,
    desc: '纯文字生成，Lightx2v 蒸馏LoRA + SageAttention',
  },
  'wan22-ti2v-5b': {
    file: 'wan22-ti2v-5b.json', name: 'Wan2.2 图+文生视频 5B',
    positive: '6', negative: '7', samplers: ['3'], latent: '55', image: '56', save: '58',
    supportsImage: true, fps: 24,
    desc: '单模型轻量版，有图无图都能跑，24fps',
  },
};

const COMFY_CLIENT_ID = 'libtv-' + Math.random().toString(36).substring(2, 10);

function isWan22Model(model) {
  return !!COMFY_MODELS[model];
}

// ==================== 配置 ====================
function getComfyConfig() {
  try {
    const c = JSON.parse(localStorage.getItem('comfyConfig'));
    if (c && typeof c === 'object') return c;
  } catch (e) { /* ignore */ }
  return { enabled: false, serverUrl: 'http://127.0.0.1:8188' };
}

function saveComfyConfigLocal(c) {
  localStorage.setItem('comfyConfig', JSON.stringify(c));
}

// ==================== 设置弹窗 ====================
// 填充 ComfyUI 字段到统一 API 设置中心（供 app.js 的 openApiCenter 调用）
function fillComfyFields() {
  const c = getComfyConfig();
  const s = document.getElementById('comfy-server');
  const e = document.getElementById('comfy-enabled');
  if (s) s.value = c.serverUrl || 'http://127.0.0.1:8188';
  if (e) e.value = c.enabled ? 'true' : 'false';
  const statusEl = document.getElementById('comfy-status');
  if (statusEl) statusEl.style.display = 'none';
}

function openComfySettings() {
  fillComfyFields();
  const m = document.getElementById('apiCenterModal');
  if (m) m.classList.add('show');
}

function closeComfySettings() {
  const m = document.getElementById('apiCenterModal');
  if (m) m.classList.remove('show');
}

function saveComfySettings() {
  const serverUrl = (document.getElementById('comfy-server').value || '').trim().replace(/\/+$/, '');
  const enabled = document.getElementById('comfy-enabled').value === 'true';
  if (enabled && !/^https?:\/\/.+/i.test(serverUrl)) {
    showToast('请输入正确的 ComfyUI 地址（以 http:// 开头）', 'error');
    return;
  }
  saveComfyConfigLocal({ serverUrl: serverUrl || 'http://127.0.0.1:8188', enabled });
  showToast(enabled ? '✅ ComfyUI 已启用' : '⚪ ComfyUI 已关闭（Wan2.2 模型将不可用）', 'success');
  closeComfySettings();
}

function clearComfySettings() {
  saveComfyConfigLocal({ serverUrl: 'http://127.0.0.1:8188', enabled: false });
  document.getElementById('comfy-server').value = 'http://127.0.0.1:8188';
  document.getElementById('comfy-enabled').value = 'false';
  showToast('已重置 ComfyUI 配置', 'info');
}

async function testComfyConnection() {
  const statusEl = document.getElementById('comfy-status');
  const serverUrl = (document.getElementById('comfy-server').value || '').trim().replace(/\/+$/, '');
  statusEl.style.display = 'block';
  statusEl.innerHTML = '<span style="color:var(--text-muted);">⏳ 正在连接 ' + serverUrl + ' ...</span>';
  try {
    const stats = await comfyFetchJson('system_stats', serverUrl);
    const sys = stats.system || {};
    const device = (stats.devices && stats.devices[0]) || {};
    statusEl.innerHTML = '<span style="color:#16a34a;">✅ 连接成功！ComfyUI v' + (sys.comfyui_version || '?') +
      ' · ' + (device.name || 'GPU') + ' · VRAM ' + (device.vram_total ? Math.round(device.vram_total / 1024 / 1024 / 1024) + 'GB' : '?') + '</span>';
  } catch (e) {
    statusEl.innerHTML = '<span style="color:var(--accent-red);">❌ 连接失败：' + e.message.substring(0, 120) + '<br>请确认 ComfyUI 已启动，且监听地址可访问（如需局域网访问请用 --listen 启动）。</span>';
  }
}

// ==================== 网络层（经本地代理，规避 CORS） ====================
function comfyProxyUrl(path, serverUrl) {
  return '/comfy/' + path + (path.includes('?') ? '&' : '?') + 'target=' + encodeURIComponent(serverUrl);
}

async function comfyFetchJson(path, serverUrlOverride) {
  const serverUrl = serverUrlOverride || getComfyConfig().serverUrl;
  const res = await fetch(comfyProxyUrl(path, serverUrl));
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error('ComfyUI[' + path + '] ' + res.status + ': ' + text.substring(0, 150));
  }
  return await res.json();
}

// 上传图片到 ComfyUI（支持 http(s) URL 和 data URL）
async function comfyUploadImage(imageUrl, serverUrl) {
  const blob = await (await fetch(imageUrl)).blob();
  const ext = (blob.type && blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const form = new FormData();
  form.append('image', blob, 'libtv_' + Date.now() + '.' + ext);
  const res = await fetch(comfyProxyUrl('upload/image', serverUrl), { method: 'POST', body: form });
  if (!res.ok) throw new Error('图片上传失败: ' + res.status);
  const j = await res.json();
  return j.name;
}

// ==================== UI工作流 → API工作流 转换 ====================
// 仿 ComfyUI 前端 graphToPrompt：用 /object_info 的节点 schema 把
// widgets_values 按声明顺序映射为命名输入。
function uiToApiWorkflow(uiWf, objectInfo, opts = {}) {
  const includeIds = new Set((opts.includeIds || []).map(String));
  const nodesById = {};
  (uiWf.nodes || []).forEach(n => { nodesById[n.id] = n; });

  // link id -> [源节点id, 源输出槽]
  const linkMap = {};
  (uiWf.links || []).forEach(l => { linkMap[l[0]] = [String(l[1]), l[2]]; });

  const isRunnable = n => {
    if (n.type === 'MarkdownNote' || n.type === 'Note') return false;
    const modeOk = n.mode === undefined || n.mode === 0 || n.mode === 1;
    return modeOk || includeIds.has(String(n.id));
  };

  const api = {};
  for (const node of uiWf.nodes || []) {
    if (!isRunnable(node)) continue;
    const info = objectInfo[node.type];
    if (!info || !info.input) continue;

    const inputs = {};

    // 1) 连线输入
    (node.inputs || []).forEach(inp => {
      if (inp.link == null) return;
      const src = linkMap[inp.link];
      if (!src) return;
      const srcNode = nodesById[src[0]];
      if (!srcNode || !isRunnable(srcNode)) return; // 来源被旁路则不接
      inputs[inp.name] = src;
    });

    // 2) widget 输入（按 schema 声明顺序消费 widgets_values）
    const req = info.input.required || {};
    const opt = info.input.optional || {};
    const order = [];
    if (info.input_order) {
      (info.input_order.required || []).forEach(n => order.push(n));
      (info.input_order.optional || []).forEach(n => order.push(n));
    } else {
      Object.keys(req).forEach(n => order.push(n));
      Object.keys(opt).forEach(n => order.push(n));
    }
    const linkedNames = new Set((node.inputs || []).filter(i => i.link != null).map(i => i.name));
    const widgets = node.widgets_values || [];
    let wIdx = 0;

    for (const name of order) {
      const def = req[name] || opt[name];
      if (!def) continue;
      const isCombo = Array.isArray(def);
      const isPrimitive = !isCombo && typeof def === 'string' &&
        ['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO'].includes(def);
      if (!isCombo && !isPrimitive) continue; // 连线类型（MODEL/LATENT/...）
      if (linkedNames.has(name)) continue;    // widget 已转成连线

      inputs[name] = widgets[wIdx++];
      // seed 类 widget 后面跟着隐藏的 control_after_generate 值
      if (['seed', 'noise_seed', 'rand_seed'].includes(name)) {
        inputs['control_after_generate'] = widgets[wIdx++];
      }
      // 图片上传 combo 后面跟着隐藏的 upload 值
      if (isCombo && def[1] && def[1].image_upload) {
        inputs['upload'] = widgets[wIdx++];
      }
    }

    api[String(node.id)] = { class_type: node.type, inputs };
  }
  return api;
}

// ==================== 参数工具 ====================
function comfyRatioSize(ratio) {
  const map = {
    '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [960, 960],
    '4:3': [1024, 768], '3:4': [768, 1024], '21:9': [1344, 576],
    '3:2': [1248, 832], '2:3': [832, 1248],
  };
  return map[ratio] || map['16:9'];
}

// Wan 视频帧数需满足 4k+1
function comfyFrameCount(durationSec, fps) {
  const raw = Math.round((durationSec || 5) * (fps || 16));
  return Math.round(raw / 4) * 4 + 1;
}

// ==================== 主入口：用 ComfyUI 生成视频 ====================
async function generateWithComfyUI(modelKey, prompt, referenceImage, options = {}) {
  const cfg = getComfyConfig();
  if (!cfg.enabled) {
    throw new Error('Wan2.2 模型需要本地 ComfyUI：请点击顶栏「🎛️ ComfyUI」配置服务器地址并开启');
  }
  const meta = COMFY_MODELS[modelKey];
  if (!meta) throw new Error('未知的 Wan2.2 模型: ' + modelKey);

  // 1) 拉取工作流与节点 schema
  const wfRes = await fetch('/workflows/' + meta.file);
  if (!wfRes.ok) throw new Error('内置工作流加载失败: ' + meta.file);
  const uiWf = await wfRes.json();

  let objectInfo;
  try {
    objectInfo = await comfyFetchJson('object_info');
  } catch (e) {
    throw new Error('无法连接 ComfyUI (' + cfg.serverUrl + ')：' + e.message.substring(0, 100));
  }

  // 2) 转换为 API 格式（图生视频时强制启用 LoadImage 节点，5B 工作流中它默认旁路）
  const useImage = !!(referenceImage && meta.image);
  const api = uiToApiWorkflow(uiWf, objectInfo, { includeIds: useImage ? [meta.image] : [] });

  // 3) 参数覆盖
  api[meta.positive].inputs.text = prompt || '';

  const [w, h] = comfyRatioSize(options.aspectRatio);
  const durationNum = parseInt(String(options.duration).replace(/[^0-9]/g, '')) || 5;
  const length = comfyFrameCount(durationNum, meta.fps);
  const latent = api[meta.latent];
  if (latent) {
    latent.inputs.width = w;
    latent.inputs.height = h;
    latent.inputs.length = length;
  }

  const seed = (options.seed >= 0 ? options.seed : Math.floor(Math.random() * 1e12));
  meta.samplers.forEach(id => {
    const s = api[id];
    if (!s) return;
    if ('noise_seed' in s.inputs) s.inputs.noise_seed = seed;
    if ('seed' in s.inputs) s.inputs.seed = seed;
  });

  // 4) 上传参考图（图生视频）
  if (useImage) {
    try {
      const filename = await comfyUploadImage(referenceImage, cfg.serverUrl);
      api[meta.image].inputs.image = filename;
    } catch (e) {
      throw new Error('参考图上传到 ComfyUI 失败: ' + e.message.substring(0, 100));
    }
  }

  // 5) 提交任务
  const postRes = await fetch(comfyProxyUrl('prompt', cfg.serverUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: api, client_id: COMFY_CLIENT_ID }),
  });
  const postText = await postRes.text();
  if (!postRes.ok) {
    let detail = postText;
    try {
      const j = JSON.parse(postText);
      if (j.error) detail = j.error.message || j.error.type || postText;
      if (j.node_errors) {
        const first = Object.values(j.node_errors)[0];
        if (first && first.errors && first.errors[0]) {
          detail += ' | 节点' + (first.errors[0].details || '') + ' ' + (first.errors[0].message || '');
        }
      }
    } catch (e) { /* 保留原文 */ }
    throw new Error('ComfyUI 拒绝任务: ' + String(detail).substring(0, 250));
  }
  try {
    promptId = JSON.parse(postText).prompt_id;
  } catch (e) {
    throw new Error('ComfyUI 返回异常: ' + postText.substring(0, 150));
  }
  if (!promptId) throw new Error('ComfyUI 未返回任务ID');

  // 6) 轮询结果（14B 可能要几分钟到几十分钟）
  const maxAttempts = 480; // 5秒 * 480 = 40 分钟
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(5000);
    let hist;
    try {
      hist = await comfyFetchJson('history/' + promptId);
    } catch (e) {
      continue; // 网络抖动，重试
    }
    const h = hist[promptId];
    if (!h) continue;

    if (h.status && (h.status.status_str === 'error')) {
      const msgs = (h.status.messages || []).map(m => m[0]).join(',');
      throw new Error('ComfyUI 执行出错: ' + msgs.substring(0, 200));
    }

    const outputs = h.outputs || {};
    const saveOut = outputs[meta.save];
    if (saveOut) {
      const arr = saveOut.videos || saveOut.gifs || saveOut.images;
      if (arr && arr.length) {
        const f = arr[0];
        const viewUrl = comfyProxyUrl(
          'view?filename=' + encodeURIComponent(f.filename) +
          '&subfolder=' + encodeURIComponent(f.subfolder || '') +
          '&type=' + encodeURIComponent(f.type || 'output'),
          cfg.serverUrl
        );
        return {
          type: 'mp4_video',
          url: viewUrl,
          thumb: referenceImage || null,
          prompt: prompt,
          duration: (options.duration || 5) + 's',
          provider: 'comfy',
          model: meta.name,
        };
      }
    }

    if (h.status && h.status.completed && !saveOut) {
      throw new Error('ComfyUI 任务完成但未返回视频（检查 SaveVideo 节点是否正常）');
    }
  }
  throw new Error('ComfyUI 生成超时（40分钟），任务仍在队列或显存不足');
}
