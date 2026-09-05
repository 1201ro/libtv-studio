// ================================================================
// LibTV Studio - AI漫剧创作工作流平台
// ================================================================

// ==================== 全局状态 ====================
const state = {
  nodes: [],          // 所有节点
  connections: [],    // 所有连线
  selectedNode: null, // 当前选中节点
  selectedConn: null, // 当前选中连线
  nodeIdCounter: 0,
  connIdCounter: 0,
  canvas: { x: 0, y: 0, scale: 1 },
  drag: null,         // 当前拖拽状态
  connecting: null,   // 当前连线状态
  generating: false,  // 是否正在生成
  gallery: [],        // 已生成的作品列表
  galleryFilter: 'all', // 作品筛选
  contextNode: null,  // 右键菜单目标节点
  contextConn: null,  // 右键菜单目标连线
  // 本地/云端代理基地址（空字符串则自动推断：http 部署用同源，file:// 用 http://127.0.0.1:3000）
  proxyBaseUrl: '',
  // 豆包视频生成配置
  doubaoConfig: {
    apiKey: 'sk-EFTQ7AMWAo6mfydOcHZbQlYCcglOaRcivzQwg23wrb6JYK9J',  // 火山引擎 API Key (ARK_API_KEY) —— 预置，可在设置中覆盖
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3',  // 豆包视频生成API
    enabled: true,        // 是否启用豆包（预置Key，开箱即用）
  },
  // Toter 聚合网关视频生成配置（New API 网关，含「入梦 Flash」视频模型）
  toterConfig: {
    apiKey: 'sk-39V9vRdKO7KESflKEYMYMzzhfpoiDrwDUwZ09IbuWhTP4Mgh',
    baseUrl: 'https://speed.toter.me',
    enabled: true,                 // 该 Key 鉴权有效，已启用
    videoModel: '入梦 Flash',       // 网关内的视频生成模型
  },
  // 自定义 API（用户直接接入的任意 OpenAI 兼容接口）
  customApiConfig: {
    name: '',                       // 显示名称
    baseUrl: '',                    // OpenAI 兼容基地址，如 https://api.example.com/v1
    apiKey: '',
    model: '',                      // 模型标识
    type: 'video',                  // 'image' | 'video'
    enabled: false,
  },
  videoTasks: {},        // 异步任务管理 {taskId: nodeId}
};

// ==================== 节点类型定义 ====================
const NODE_TYPES = {
  script: {
    name: '脚本生成器',
    icon: '📜',
    color: '#4d8dff',
    category: '创作',
    desc: 'AI生成漫剧分镜脚本',
    inputs: [],
    outputs: ['script'],
    defaultData: {
      story: '一个现代都市女孩意外穿越到古代长安，成为了将门之女。她凭借现代知识在古代如鱼得水，却卷入了一场宫廷阴谋……',
      genre: '古风言情',
      duration: '60秒',
      sceneCount: 8,
      style: '日漫风',
      model: 'qwen',
    },
  },
  character: {
    name: '角色设计器',
    icon: '👤',
    color: '#a855f7',
    category: '创作',
    desc: '生成角色设定图(三视图)',
    inputs: [],
    outputs: ['character'],
    defaultData: {
      name: '女主角·苏晚晴',
      description: '18岁少女，黑色长直发，大眼睛，身穿淡蓝色汉服，气质清纯可爱，面带微笑',
      style: 'anime',
      views: 'three-view',
      model: 'flux',
      ratio: '4:3',
    },
  },
  imageGen: {
    name: '分镜图生成器',
    icon: '🖼️',
    color: '#ec4899',
    category: '生成',
    desc: '根据脚本批量生成分镜图',
    inputs: ['script', 'character'],
    outputs: ['images'],
    defaultData: {
      model: 'flux',
      style: 'anime',
      ratio: '9:16',
      quality: 'high',
      cameraControl: true,
      promptPrefix: '',
    },
  },
  textToImage: {
    name: '文生图',
    icon: '🎨',
    color: '#06b6d4',
    category: '生成',
    desc: '文字描述生成图片',
    inputs: [],
    outputs: ['image'],
    defaultData: {
      prompt: '一位身穿红色汉服的女子，手持油纸伞，站在桃花树下，唯美古风动漫风格',
      style: 'anime',
      ratio: '3:4',
    },
  },
  imageToImage: {
    name: '图生图',
    icon: '🖼️',
    color: '#f59e0b',
    category: '生成',
    desc: '参考图+描述生成新图',
    inputs: ['image'],
    outputs: ['image'],
    defaultData: {
      prompt: '将图片转换为古风动漫风格，保持人物特征',
      style: 'gufeng',
      strength: 0.7,
      ratio: '3:4',
    },
  },
  videoGen: {
    name: '视频生成器',
    icon: '🎬',
    color: '#22c55e',
    category: '生成',
    desc: '豆包图生视频(图生视频)',
    inputs: ['images'],
    outputs: ['videos'],
    defaultData: {
      model: 'toter-rumeng',        // 默认 Toter 网关「入梦 Flash」视频模型
      duration: '5秒',
      motion: 'medium',
      prompt: '',
      aspectRatio: '9:16',           // 豆包支持的画幅
      seed: -1,                      // 随机种子
    },
  },
  textToVideo: {
    name: '文生视频',
    icon: '🎥',
    color: '#10b981',
    category: '生成',
    desc: '豆包文生视频(文字→视频)',
    inputs: [],
    outputs: ['video'],
    defaultData: {
      model: 'toter-rumeng',        // 默认 Toter 网关「入梦 Flash」视频模型
      prompt: '古风女子在桃花树下回眸，花瓣飘落，微风吹动长发，唯美浪漫',
      duration: '5秒',
      style: 'cinematic',
      aspectRatio: '9:16',
      seed: -1,
    },
  },
  music: {
    name: '音乐生成器',
    icon: '🎵',
    color: '#8b5cf6',
    category: '音频',
    desc: '生成背景音乐',
    inputs: [],
    outputs: ['audio'],
    defaultData: {
      style: '古风',
      mood: '浪漫',
      duration: '60秒',
    },
  },
  export: {
    name: '导出合成器',
    icon: '📤',
    color: '#ef4444',
    category: '输出',
    desc: '合成最终成片',
    inputs: ['videos', 'audio'],
    outputs: [],
    defaultData: {
      format: 'MP4',
      resolution: '1080x1920',
      fps: 30,
    },
  },
};

// ==================== 画面比例 ====================
const RATIO_OPTIONS = ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9', '3:2', '2:3'];
const RATIO_LABELS = {
  '1:1': '1:1 方形',
  '4:3': '4:3 传统',
  '3:4': '3:4 竖版',
  '16:9': '16:9 宽屏',
  '9:16': '9:16 竖屏',
  '21:9': '21:9 超宽',
  '3:2': '3:2 照片',
  '2:3': '2:3 照片',
};
const RATIO_DIMS = {
  '1:1': [1024, 1024],
  '4:3': [1152, 864],
  '3:4': [864, 1152],
  '16:9': [1280, 720],
  '9:16': [720, 1280],
  '21:9': [1344, 576],
  '3:2': [1248, 832],
  '2:3': [832, 1248],
};
// 比例 → 宽高像素
function ratioToSize(ratio) {
  return RATIO_DIMS[ratio] || [864, 1152];
}
// 生成比例下拉选项
function ratioOptionsHTML(current) {
  return RATIO_OPTIONS.map(r => `<option value="${r}" ${r === current ? 'selected' : ''}>${RATIO_LABELS[r]}</option>`).join('');
}

// ==================== 初始化 ====================
function init() {
  renderSidebar();
  initCanvas();
  initKeyboard();
  // 创建默认工作流
  createDefaultWorkflow();
  renderAll();
}

// ==================== 左侧节点库 ====================
function renderSidebar() {
  const list = document.getElementById('sidebarList');
  const categories = {};
  Object.entries(NODE_TYPES).forEach(([key, type]) => {
    if (!categories[type.category]) categories[type.category] = [];
    categories[type.category].push({ key, ...type });
  });

  list.innerHTML = Object.entries(categories).map(([cat, items]) => `
    <div class="node-category">${cat}</div>
    ${items.map(item => `
      <div class="node-template" data-type="${item.key}" onclick="addNode('${item.key}')">
        <div class="node-template-icon" style="background:${item.color}22;color:${item.color};">${item.icon}</div>
        <div class="node-template-info">
          <div class="node-template-name">${item.name}</div>
          <div class="node-template-desc">${item.desc}</div>
        </div>
      </div>
    `).join('')}
  `).join('');
}

function filterNodes() {
  const query = document.getElementById('nodeSearch').value.toLowerCase();
  document.querySelectorAll('.node-template').forEach(el => {
    const name = el.querySelector('.node-template-name').textContent.toLowerCase();
    const desc = el.querySelector('.node-template-desc').textContent.toLowerCase();
    el.style.display = (name.includes(query) || desc.includes(query)) ? '' : 'none';
  });
}

// ==================== 画布引擎 ====================
function initCanvas() {
  const wrapper = document.getElementById('canvasWrapper');
  const content = document.getElementById('canvasContent');

  // 拖拽画布
  wrapper.addEventListener('mousedown', (e) => {
    if (e.target === wrapper || e.target.classList.contains('canvas-bg') || e.target === content || e.target.tagName === 'svg' || e.target.tagName === 'SVG') {
      if (state.connecting) { cancelConnecting(); return; }
      state.drag = { type: 'canvas', startX: e.clientX, startY: e.clientY, originX: state.canvas.x, originY: state.canvas.y };
      content.classList.add('dragging');
      deselectAll();
    }
  });

  // 右键：空白处 → 添加节点菜单；节点上 → 节点菜单
  wrapper.addEventListener('contextmenu', (e) => {
    const nodeEl = e.target.closest ? e.target.closest('.node') : null;
    if (nodeEl) {
      // 节点上右键（节点头部自带处理，这里兜底节点体）
      e.preventDefault();
      showNodeContextMenu(e, nodeEl.id.replace('node-', ''));
    } else if (e.target === wrapper || e.target.classList.contains('canvas-bg') || e.target === content || e.target.tagName === 'svg' || e.target.tagName === 'SVG') {
      showAddNodeMenu(e);
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (state.drag) {
      if (state.drag.type === 'canvas') {
        state.canvas.x = state.drag.originX + (e.clientX - state.drag.startX);
        state.canvas.y = state.drag.originY + (e.clientY - state.drag.startY);
        updateCanvasTransform();
      } else if (state.drag.type === 'node') {
        const node = state.nodes.find(n => n.id === state.drag.nodeId);
        if (node) {
          node.x = state.drag.originX + (e.clientX - state.drag.startX) / state.canvas.scale;
          node.y = state.drag.originY + (e.clientY - state.drag.startY) / state.canvas.scale;
          updateNodePosition(node);
          updateConnections();
        }
      } else if (state.drag.type === 'resize') {
        const node = state.nodes.find(n => n.id === state.drag.nodeId);
        if (node) {
          const dx = (e.clientX - state.drag.startX) / state.canvas.scale;
          const dy = (e.clientY - state.drag.startY) / state.canvas.scale;
          node.width = Math.max(state.drag.minW, state.drag.originW + dx);
          node.height = Math.max(state.drag.minH, state.drag.originH + dy);
          applyNodeSize(node);
          updateConnections();
        }
      } else if (state.drag.type === 'connect') {
        updateTempConnection(e);
      }
    } else if (state.connecting) {
      // 粘性连线模式：点击输出端口后移动鼠标，临时线跟随
      updateTempConnection(e);
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (state.drag) {
      if (state.drag.type === 'canvas') {
        document.getElementById('canvasContent').classList.remove('dragging');
      }
      if (state.drag.type === 'connect') {
        const moved = Math.abs(e.clientX - state.drag.startX) + Math.abs(e.clientY - state.drag.startY);
        if (moved < 6) {
          // 几乎没有移动 → 进入粘性连线模式（松手后线继续跟随鼠标，点击目标端口完成）
          state.drag = null;
          highlightConnectablePorts();
          return;
        }
        finishConnecting(e);
      }
      state.drag = null;
    }
  });

  // 缩放
  wrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoomCanvas(delta, e.clientX, e.clientY);
  });

  updateCanvasTransform();
}

function updateCanvasTransform() {
  const content = document.getElementById('canvasContent');
  content.style.transform = `translate(${state.canvas.x}px, ${state.canvas.y}px) scale(${state.canvas.scale})`;
  document.getElementById('zoomDisplay').textContent = Math.round(state.canvas.scale * 100) + '%';
}

function zoomCanvas(delta, cx, cy) {
  const wrapper = document.getElementById('canvasWrapper');
  const rect = wrapper.getBoundingClientRect();
  if (cx === undefined) cx = rect.width / 2 + rect.left;
  if (cy === undefined) cy = rect.height / 2 + rect.top;

  const oldScale = state.canvas.scale;
  let newScale = oldScale + delta;
  newScale = Math.max(0.2, Math.min(3, newScale));

  const dx = (cx - rect.left - state.canvas.x) / oldScale;
  const dy = (cy - rect.top - state.canvas.y) / oldScale;

  state.canvas.x = cx - rect.left - dx * newScale;
  state.canvas.y = cy - rect.top - dy * newScale;
  state.canvas.scale = newScale;

  updateCanvasTransform();
}

function resetCanvas() {
  state.canvas = { x: 0, y: 0, scale: 1 };
  updateCanvasTransform();
}

function fitCanvas() {
  if (state.nodes.length === 0) { resetCanvas(); return; }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  state.nodes.forEach(n => {
    const el = document.getElementById('node-' + n.id);
    const w = n.width || (el ? el.offsetWidth : 280) || 280;
    const h = n.height || (el ? el.offsetHeight : 200) || 200;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w);
    maxY = Math.max(maxY, n.y + h);
  });
  const wrapper = document.getElementById('canvasWrapper');
  const rect = wrapper.getBoundingClientRect();
  const padding = 40;
  const scaleX = (rect.width - padding * 2) / (maxX - minX);
  const scaleY = (rect.height - padding * 2) / (maxY - minY);
  state.canvas.scale = Math.min(scaleX, scaleY, 1.5);
  state.canvas.x = padding - minX * state.canvas.scale;
  state.canvas.y = padding - minY * state.canvas.scale;
  updateCanvasTransform();
}

// ==================== 节点管理 ====================
// 获取节点占用的矩形（含尺寸）
function getNodeRect(n) {
  const el = document.getElementById('node-' + n.id);
  const w = n.width || (el ? el.offsetWidth : 280) || 280;
  const h = n.height || (el ? el.offsetHeight : 220) || 220;
  return { x: n.x, y: n.y, w: w, h: h };
}

// 判断两个矩形是否重叠（留 24px 间距）
function rectsOverlap(a, b) {
  const gap = 24;
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x &&
         a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
}

// 寻找一个不与任何现有节点重叠的落点
function findFreeSpot(x, y) {
  const self = { x: x, y: y, w: 280, h: 220 };
  let guard = 0;
  while (guard++ < 300 && state.nodes.some(n => rectsOverlap(self, getNodeRect(n)))) {
    self.x += 48;
    self.y += 48;
    // 超出边界后折返换行，继续找空位
    if (self.x > 2400) { self.x = 60; self.y += 40; }
    if (self.y > 1600) { self.y = 60; self.x += 60; }
  }
  return { x: self.x, y: self.y };
}

function addNode(type, x, y) {
  const nodeType = NODE_TYPES[type];
  if (!nodeType) return;

  state.nodeIdCounter++;

  // 计算落点，并避开已有节点，避免重叠堆叠
  const rawX = x !== undefined ? x : 300 + Math.random() * 200;
  const rawY = y !== undefined ? y : 150 + Math.random() * 100;
  const spot = findFreeSpot(Math.round(rawX), Math.round(rawY));

  const node = {
    id: 'n' + state.nodeIdCounter,
    type: type,
    x: spot.x,
    y: spot.y,
    data: { ...nodeType.defaultData },
    status: 'idle',
    output: null,
    outputs: {},
  };

  state.nodes.push(node);
  renderNode(node);
  showToast(`已添加：${nodeType.name}`, 'success');
  return node;
}

function deleteNode(nodeId) {
  const idx = state.nodes.findIndex(n => n.id === nodeId);
  if (idx === -1) return;

  // 删除相关连线
  state.connections = state.connections.filter(c => c.fromNode !== nodeId && c.toNode !== nodeId);

  // 删除DOM
  const el = document.getElementById('node-' + nodeId);
  if (el) el.remove();

  state.nodes.splice(idx, 1);

  if (state.selectedNode === nodeId) {
    state.selectedNode = null;
    closeProps();
  }

  updateConnections();
  showToast('节点已删除', 'info');
}

function renderNode(node) {
  const nodeType = NODE_TYPES[node.type];
  const el = document.createElement('div');
  el.className = 'node';
  el.id = 'node-' + node.id;
  el.style.left = node.x + 'px';
  el.style.top = node.y + 'px';
  el.style.borderTop = `3px solid ${nodeType.color}`;
  if (node.width) el.style.width = node.width + 'px';
  if (node.height) el.style.height = node.height + 'px';

  el.innerHTML = `
    <div class="node-header" onmousedown="startDragNode(event, '${node.id}')" ondblclick="openProps('${node.id}')" oncontextmenu="showNodeContextMenu(event, '${node.id}'); return false;">
      <div class="node-icon" style="background:${nodeType.color}22;">${nodeType.icon}</div>
      <div class="node-title">${nodeType.name}</div>
      <div class="node-status idle" id="status-${node.id}">待执行</div>
      <button class="node-delete-btn" onclick="event.stopPropagation();deleteNode('${node.id}')" title="删除节点">✕</button>
    </div>
    <div class="node-body" id="body-${node.id}">
      ${renderNodeBody(node)}
    </div>
    ${renderNodePorts(node)}
    <div class="node-resize" onmousedown="startResizeNode(event, '${node.id}')" title="拖拽调整大小"></div>
  `;

  document.getElementById('canvasContent').appendChild(el);
  attachPortEvents(el, node);
}

// 应用节点尺寸
function applyNodeSize(node) {
  const el = document.getElementById('node-' + node.id);
  if (!el) return;
  if (node.width) el.style.width = node.width + 'px';
  else el.style.width = '';
  if (node.height) el.style.height = node.height + 'px';
  else el.style.height = '';
}

// 刷新节点体（生成结果后重渲染），但保持节点尺寸不变
function refreshNodeBody(node) {
  const el = document.getElementById('node-' + node.id);
  if (!el) return;
  // 若尺寸未手动设定，先锁定为当前尺寸，避免生成图片/内容后节点被撑大
  if (!node.width) node.width = el.offsetWidth;
  if (!node.height) node.height = el.offsetHeight;
  el.querySelector('.node-body').innerHTML = renderNodeBody(node);
  applyNodeSize(node);
}

// 在节点卡片上直接编辑字段时同步回 node.data
function quickEditNodeData(nodeId, field, value) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;
  if (field === 'seed') value = parseInt(value, 10) || 0;
  else if (field === 'strength') value = parseFloat(value) || 0.5;
  node.data[field] = value;
  refreshNodeBody(node);
}

// 开始调整节点大小
function startResizeNode(e, nodeId) {
  e.stopPropagation();
  e.preventDefault();
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const el = document.getElementById('node-' + nodeId);
  state.drag = {
    type: 'resize',
    nodeId: nodeId,
    startX: e.clientX,
    startY: e.clientY,
    originW: el.offsetWidth,
    originH: el.offsetHeight,
    minW: 220,
    minH: 120,
  };
}

// 视频生成按钮文案根据当前模型切换
function videoGenButtonLabel(model) {
  if (model === 'toter-rumeng') return '🔥 入梦生成视频';
  if (model === 'custom-api') {
    const name = state.customApiConfig && state.customApiConfig.name ? state.customApiConfig.name : '自定义API';
    return `🔥 ${name}生成视频`;
  }
  if (model && model.startsWith('wan22')) return '🔥 Wan2.2生成视频';
  return '🔥 豆包生成视频';
}

// 视频模型短名映射（节点卡片显示用）
function modelShortLabel(model) {
  const map = {
    'seedance2': 'Seedance 2.0',
    'seedance2-fast': 'SD 2.0 Fast',
    'doubao-pro': '豆包 Pro 1.0',
    'doubao-lite': '豆包 Lite',
    'seedance': 'Seedance Pro',
    'toter-rumeng': '入梦 Flash',
    'wan22-i2v-14b': 'Wan2.2 I2V 14B',
    'wan22-i2v-fast': 'Wan2.2 I2V 加速',
    'wan22-t2v-14b': 'Wan2.2 T2V 14B',
    'wan22-t2v-fast': 'Wan2.2 T2V 加速',
    'wan22-ti2v-5b': 'Wan2.2 TI2V 5B',
    'custom-api': (state.customApiConfig && state.customApiConfig.name) ? ('🧩 ' + state.customApiConfig.name) : '🧩 自定义API',
  };
  return map[model] || ('豆包 ' + model);
}

// 自定义 API 下拉选项（仅当启用且类型匹配时显示）
function customApiVideoOption(model) {
  const c = state.customApiConfig;
  if (!c.enabled || c.type !== 'video') return '';
  const label = c.name ? ('🧩 ' + c.name) : '🧩 自定义API(视频)';
  return `<option value="custom-api" ${model === 'custom-api' ? 'selected' : ''}>${label}</option>`;
}
function customApiImageOption(model) {
  const c = state.customApiConfig;
  if (!c.enabled || c.type !== 'image') return '';
  const label = c.name ? ('🧩 ' + c.name) : '🧩 自定义API(图片)';
  return `<option value="custom-api" ${model === 'custom-api' ? 'selected' : ''}>${label}</option>`;
}

function renderNodeBody(node) {
  const type = node.type;
  const d = node.data;

  if (type === 'script') {
    return `
      <div class="node-field">
        <label>📖 故事大纲</label>
        <textarea readonly style="min-height:50px;cursor:pointer;" onclick="openProps('${node.id}')">${d.story.substring(0, 60)}...</textarea>
      </div>
      <div class="node-field-row">
        <div class="node-field"><label>类型</label><input value="${d.genre}" readonly style="cursor:pointer;" onclick="openProps('${node.id}')"></div>
        <div class="node-field"><label>分镜数</label><input value="${d.sceneCount}" readonly style="cursor:pointer;" onclick="openProps('${node.id}')"></div>
      </div>
      <button class="node-btn primary" onclick="executeNode('${node.id}')" id="btn-${node.id}">⚡ 生成脚本</button>
      ${node.output ? renderScriptPreview(node) : ''}
    `;
  }

  if (type === 'character') {
    return `
      <div class="node-field">
        <label>👤 角色名称</label>
        <input value="${d.name}" readonly style="cursor:pointer;" onclick="openProps('${node.id}')">
      </div>
      <div class="node-field">
        <label>📝 外貌描述</label>
        <textarea readonly style="min-height:40px;cursor:pointer;" onclick="openProps('${node.id}')">${d.description.substring(0, 40)}...</textarea>
      </div>
      <button class="node-btn primary" onclick="executeNode('${node.id}')" id="btn-${node.id}">⚡ 生成角色图</button>
      ${node.output ? `<div class="node-preview img-loading-wrap" onclick="openImagePreview('${node.output}')"><div class="img-spinner"></div><img src="${node.output}" alt="角色图" onload="this.parentElement.classList.add('loaded')" onerror="this.parentElement.classList.add('error');this.style.display='none'"></div>` : ''}
    `;
  }

  if (type === 'imageGen') {
    const hasScript = state.connections.some(c => c.toNode === node.id && c.toPort === 'script');
    return `
      <div class="node-field">
        <label>📦 模型 / 风格</label>
        <div class="node-field-row">
          <input value="${d.model}" readonly style="cursor:pointer;" onclick="openProps('${node.id}')">
          <input value="${d.style}" readonly style="cursor:pointer;" onclick="openProps('${node.id}')">
        </div>
      </div>
      <div class="node-field-row">
        <div class="node-field"><label>比例</label><input value="${d.ratio}" readonly style="cursor:pointer;" onclick="openProps('${node.id}')"></div>
        <div class="node-field"><label>画质</label><input value="${d.quality}" readonly style="cursor:pointer;" onclick="openProps('${node.id}')"></div>
      </div>
      <button class="node-btn primary" onclick="executeNode('${node.id}')" id="btn-${node.id}" ${!hasScript ? 'disabled' : ''}>
        ${!hasScript ? '⚠️ 请连接脚本' : '⚡ 生成分镜图'}
      </button>
      ${node.outputs.images ? renderImageGrid(node.outputs.images) : ''}
    `;
  }

  if (type === 'textToImage') {
    return `
      <div class="node-field">
        <label>🎨 画面描述</label>
        <textarea readonly style="min-height:50px;cursor:pointer;" onclick="openProps('${node.id}')">${d.prompt.substring(0, 50)}...</textarea>
      </div>
      <div class="node-field-row">
        <div class="node-field"><label>风格</label><input value="${d.style}" readonly style="cursor:pointer;" onclick="openProps('${node.id}')"></div>
        <div class="node-field"><label>比例</label><input value="${d.ratio}" readonly style="cursor:pointer;" onclick="openProps('${node.id}')"></div>
      </div>
      <button class="node-btn primary" onclick="executeNode('${node.id}')" id="btn-${node.id}">⚡ 生成图片</button>
      ${node.output ? `<div class="node-preview img-loading-wrap" onclick="openImagePreview('${node.output}')"><div class="img-spinner"></div><img src="${node.output}" alt="生成图" onload="this.parentElement.classList.add('loaded')" onerror="this.parentElement.classList.add('error');this.style.display='none'"></div>` : ''}
    `;
  }

  if (type === 'imageToImage') {
    return `
      <div class="node-field">
        <label>🎨 转换描述</label>
        <textarea readonly style="min-height:40px;cursor:pointer;" onclick="openProps('${node.id}')">${d.prompt.substring(0, 40)}...</textarea>
      </div>
      <div class="node-field-row">
        <div class="node-field"><label>风格</label><input value="${d.style}" readonly style="cursor:pointer;" onclick="openProps('${node.id}')"></div>
        <div class="node-field"><label>比例</label><input value="${d.ratio}" readonly style="cursor:pointer;" onclick="openProps('${node.id}')"></div>
        <div class="node-field"><label>强度</label><input value="${d.strength}" readonly style="cursor:pointer;" onclick="openProps('${node.id}')"></div>
      </div>
      <button class="node-btn primary" onclick="executeNode('${node.id}')" id="btn-${node.id}">⚡ 转换图片</button>
      ${node.output ? `<div class="node-preview img-loading-wrap" onclick="openImagePreview('${node.output}')"><div class="img-spinner"></div><img src="${node.output}" alt="结果" onload="this.parentElement.classList.add('loaded')" onerror="this.parentElement.classList.add('error');this.style.display='none'"></div>` : ''}
    `;
  }

  if (type === 'videoGen') {
    const hasImages = state.connections.some(c => c.toNode === node.id && c.toPort === 'images');
    return `
      <div class="node-field">
        <label>🔥 模型 / 时长 / 画幅</label>
        <div class="node-field-row">
          <select title="模型" onchange="quickEditNodeData('${node.id}', 'model', this.value)">
            ${[
              { v: 'toter-rumeng', l: '入梦' },
              { v: 'seedance2', l: 'SD2' },
              { v: 'seedance2-fast', l: 'SD2Fast' },
              { v: 'doubao-pro', l: '豆包Pro' },
              { v: 'doubao-lite', l: '豆包Lite' },
              { v: 'seedance', l: 'Seedance' },
            ].map(m => `<option value="${m.v}" ${m.v === d.model ? 'selected' : ''}>${m.l}</option>`).join('')}${customApiVideoOption(d.model)}
          </select>
          <select title="时长" onchange="quickEditNodeData('${node.id}', 'duration', this.value)">${['5秒','8秒','10秒','15秒'].map(t => `<option ${t === d.duration ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <select title="画幅" onchange="quickEditNodeData('${node.id}', 'aspectRatio', this.value)">${ratioOptionsHTML(d.aspectRatio)}</select>
        </div>
      </div>
      <div class="node-field">
        <label>🎬 运动描述</label>
        <input value="${d.motion}" onchange="quickEditNodeData('${node.id}', 'motion', this.value)">
      </div>
      <button class="node-btn primary" onclick="executeNode('${node.id}')" id="btn-${node.id}" ${!hasImages ? 'disabled' : ''}>
        ${!hasImages ? '⚠️ 请连接分镜图' : videoGenButtonLabel(d.model)}
      </button>
      ${node.outputs.videos ? renderVideoGrid(node.outputs.videos) : ''}
    `;
  }

  if (type === 'textToVideo') {
    return `
      <div class="node-field">
        <label>🔥 模型</label>
        <select title="模型" onchange="quickEditNodeData('${node.id}', 'model', this.value)">
          ${[
            { v: 'toter-rumeng', l: '🌟 入梦 Flash' },
            { v: 'seedance2', l: '🚀 Seedance 2.0' },
            { v: 'seedance2-fast', l: '⚡ Seedance 2.0 Fast' },
            { v: 'doubao-pro', l: '🔥 Doubao-Seedance Pro' },
            { v: 'doubao-lite', l: '⚡ Doubao-Seedance Lite' },
            { v: 'seedance', l: '🎬 Seedance Pro' },
          ].map(m => `<option value="${m.v}" ${m.v === d.model ? 'selected' : ''}>${m.l}</option>`).join('')}${customApiVideoOption(d.model)}
        </select>
      </div>
      <div class="node-field">
        <label>🎥 视频描述</label>
        <textarea style="min-height:50px;" onchange="quickEditNodeData('${node.id}', 'prompt', this.value)">${d.prompt}</textarea>
      </div>
      <div class="node-field-row">
        <div class="node-field"><label>时长</label><select onchange="quickEditNodeData('${node.id}', 'duration', this.value)">${['5秒','8秒','10秒','15秒'].map(t => `<option ${t === d.duration ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="node-field"><label>画幅</label><select onchange="quickEditNodeData('${node.id}', 'aspectRatio', this.value)">${ratioOptionsHTML(d.aspectRatio)}</select></div>
        <div class="node-field"><label>风格</label><select onchange="quickEditNodeData('${node.id}', 'style', this.value)">${['cinematic','anime','documentary','mv'].map(s => `<option ${s === d.style ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      </div>
      <button class="node-btn primary" onclick="executeNode('${node.id}')" id="btn-${node.id}">${videoGenButtonLabel(d.model)}</button>
      ${node.output ? renderVideoPreview(node.output) : ''}
    `;
  }

  if (type === 'music') {
    return `
      <div class="node-field-row">
        <div class="node-field"><label>风格</label><input value="${d.style}" readonly style="cursor:pointer;" onclick="openProps('${node.id}')"></div>
        <div class="node-field"><label>情绪</label><input value="${d.mood}" readonly style="cursor:pointer;" onclick="openProps('${node.id}')"></div>
      </div>
      <div class="node-field"><label>时长</label><input value="${d.duration}" readonly style="cursor:pointer;" onclick="openProps('${node.id}')"></div>
      <button class="node-btn primary" onclick="executeNode('${node.id}')" id="btn-${node.id}">🎵 生成音乐</button>
    `;
  }

  if (type === 'export') {
    const hasVideos = state.connections.some(c => c.toNode === node.id && c.toPort === 'videos');
    return `
      <div class="node-field-row">
        <div class="node-field"><label>格式</label><input value="${d.format}" readonly style="cursor:pointer;" onclick="openProps('${node.id}')"></div>
        <div class="node-field"><label>分辨率</label><input value="${d.resolution}" readonly style="cursor:pointer;" onclick="openProps('${node.id}')"></div>
      </div>
      <button class="node-btn primary" onclick="executeNode('${node.id}')" id="btn-${node.id}" ${!hasVideos ? 'disabled' : ''}>
        ${!hasVideos ? '⚠️ 请连接视频' : '📤 合成成片'}
      </button>
    `;
  }

  return '';
}

function renderScriptPreview(node) {
  if (!node.output || !node.output.scenes) return '';
  return `
    <div class="storyboard-table" id="script-${node.id}">
      ${node.output.scenes.map((s, i) => `
        <div class="storyboard-row" onclick="openProps('${node.id}')">
          <div class="storyboard-num">${i + 1}</div>
          <div class="storyboard-desc">${s.description}</div>
          <div class="storyboard-shot">${s.shot}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderImageGrid(images) {
  return `
    <div class="node-preview-grid">
      ${images.slice(0, 6).map((url, i) => `<div class="img-loading-wrap" id="grid-img-${i}">
        <div class="img-spinner"></div>
        <img src="${url}" onclick="openImagePreview('${url}')" alt="分镜图${i+1}" loading="lazy"
          onload="this.parentElement.classList.add('loaded')"
          onerror="this.parentElement.classList.add('error');this.style.display='none';this.parentElement.innerHTML+='<div class=\\'img-error\\'>⚠️ 加载失败</div>'">
      </div>`).join('')}
    </div>
    <div style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:4px;">共 ${images.length} 张分镜图</div>
  `;
}

function renderVideoPreview(video) {
  if (!video) return '';
  const url = typeof video === 'string' ? video : (video.url || video.thumb);
  if (!url) return '';

  const provider = video.provider || 'unknown';
  const isMp4 = video.type === 'mp4_video' || url.match(/\.(mp4|webm|mov)$/i);

  // 真正的豆包MP4视频
  if (isMp4) {
    return `
      <div class="node-preview video-preview" onclick="openVideoPreview('${url}', '${(video.prompt||'').replace(/'/g, "\\'")}', '${provider}')">
        <video src="${url}" muted loop playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video>
        <div class="video-play-overlay"><div class="play-icon">▶</div></div>
        <div class="video-badge" style="background:${provider === 'doubao' ? '#ff6b35' : '#666'};">🔥 豆包视频</div>
      </div>
    `;
  }

  // 占位图
  return `
    <div class="node-preview video-preview" onclick="openVideoPreview('${url}', '${(video.prompt||'').replace(/'/g, "\\'")}', '${provider}')">
      <img src="${url}" alt="视频预览" loading="lazy">
      <div class="video-play-overlay"><div class="play-icon">▶</div></div>
      <div class="video-badge" style="background:${provider === 'doubao' ? '#ff6b35' : (provider === 'error' ? '#dc2626' : '#666')};">
        ${provider === 'doubao' ? '🔥 豆包' : (provider === 'error' ? '⚠️ 失败' : '🎬 占位帧')}
      </div>
    </div>
  `;
}

function renderVideoGrid(videos) {
  const validVideos = videos.filter(v => v !== null);
  if (validVideos.length === 0) return '';
  return `
    <div class="node-preview-grid">
      ${validVideos.slice(0, 6).map((v, i) => {
        const url = typeof v === 'string' ? v : (v.url || v.thumb);
        if (!url) return '';
        const provider = v.provider || 'unknown';
        const isMp4 = v.type === 'mp4_video' || url.match(/\.(mp4|webm|mov)$/i);
        const inner = isMp4
          ? `<video src="${url}" muted loop playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video>`
          : `<img src="${url}" alt="视频${i+1}" loading="lazy">`;
        const badgeColor = provider === 'doubao' ? '#ff6b35'
          : provider === 'toter' ? '#22d3ee'
          : provider === 'comfy' ? '#8b5cf6'
          : provider === 'error' ? '#dc2626' : '#666';
        const badgeText = provider === 'doubao' ? '🔥 豆包'
          : provider === 'toter' ? '🌟 Toter'
          : provider === 'comfy' ? '🎛️ ComfyUI'
          : provider === 'error' ? '⚠️' : '🎬 占位';
        return `<div class="video-thumb" onclick="openVideoPreview('${url}', '${(v.prompt||'').replace(/'/g, "\\'")}', '${provider}')">
          ${inner}
          <div class="video-play-overlay"><div class="play-icon">▶</div></div>
          <div class="video-badge" style="position:absolute;top:4px;left:4px;background:${badgeColor};font-size:9px;padding:1px 4px;border-radius:3px;">${badgeText}</div>
        </div>`;
      }).join('')}
    </div>
    <div style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:4px;">共 ${validVideos.length} 个视频片段</div>
  `;
}

function openVideoPreview(url, prompt, provider) {
  const modal = document.getElementById('previewModal');
  const isMp4 = url.match(/\.(mp4|webm|mov)$/i);
  const providerName = provider === 'doubao' ? '🔥 豆包 Doubao-Seedance' :
                       provider === 'toter' ? '🌟 Toter 网关 · 入梦 Flash' :
                       provider === 'comfy' ? '🎛️ 本地 ComfyUI · Wan2.2' :
                       provider === 'fallback' ? '⚡ 占位预览（关键帧）' :
                       provider === 'error' ? '⚠️ 生成失败' : 'AI生成';
  const providerColor = provider === 'doubao' ? '#ff6b35' :
                        provider === 'toter' ? '#22d3ee' :
                        provider === 'comfy' ? '#8b5cf6' :
                        provider === 'error' ? '#dc2626' : '#666';

  const mediaEl = isMp4
    ? `<video src="${url}" controls autoplay loop playsinline style="max-width:90%;max-height:70vh;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);"></video>`
    : `<img src="${url}" alt="视频预览" style="max-width:90%;max-height:70vh;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);">`;

  document.getElementById('previewModalContent').innerHTML = `
    <div class="video-preview-large">
      ${mediaEl}
      <div class="video-preview-info">
        <div class="video-preview-badge" style="background:${providerColor};">${providerName}</div>
        <div class="video-preview-prompt">${prompt || 'AI生成视频片段'}</div>
        ${isMp4 ? `<div class="video-preview-hint" style="color:#4ade80;">✅ 这是豆包生成的真实MP4视频</div>`
                : `<div class="video-preview-hint">📹 这是关键帧占位，配置豆包API Key后可生成真实视频</div>`}
      </div>
    </div>
  `;
  modal.classList.add('show');
}

function renderNodePorts(node) {
  const nodeType = NODE_TYPES[node.type];
  let html = '';
  nodeType.inputs.forEach((input, i) => {
    const connected = state.connections.some(c => c.toNode === node.id && c.toPort === input);
    html += `<div class="node-port input ${connected ? 'connected' : ''}"
      style="top:${50 + i * 24}px;"
      data-node="${node.id}" data-port="${input}" data-direction="input"
      title="输入: ${input}（拖入或点击连线）">
      <span class="node-port-label">${input}</span>
    </div>`;
  });
  nodeType.outputs.forEach((output, i) => {
    const connected = state.connections.some(c => c.fromNode === node.id && c.fromPort === output);
    html += `<div class="node-port output ${connected ? 'connected' : ''}"
      style="top:${50 + i * 24}px;"
      data-node="${node.id}" data-port="${output}" data-direction="output"
      title="输出: ${output}（拖出或点击连线）">
      <span class="node-port-label">${output}</span>
    </div>`;
  });
  return html;
}

function attachPortEvents(el, node) {
  el.querySelectorAll('.node-port').forEach(port => {
    port.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const nodeId = port.dataset.node;
      const portName = port.dataset.port;
      const direction = port.dataset.direction;

      if (direction === 'output') {
        // 反向粘性连线中：点击输出端口即完成
        if (state.connecting && state.connecting.reverse) {
          completeConnection(nodeId, portName, state.connecting.toNode, state.connecting.toPort);
          cancelConnecting();
          return;
        }
        startConnecting(nodeId, portName, e);
      } else {
        // 输入端口：如果正在连线中 → 直接完成连接
        if (state.connecting && !state.connecting.reverse) {
          completeConnection(state.connecting.fromNode, state.connecting.fromPort, nodeId, portName);
          cancelConnecting();
          return;
        }
        const existingConn = state.connections.find(c => c.toNode === nodeId && c.toPort === portName);
        if (existingConn) {
          // 已有连线 → 拖拽可拆开重连
          state.connections = state.connections.filter(c => c !== existingConn);
          updateConnections();
          renderAllPorts();
          startConnecting(existingConn.fromNode, existingConn.fromPort, e);
        } else {
          // 反向连线：从输入端口拖到输出端口
          startConnectingReverse(nodeId, portName, e);
        }
      }
    });
  });
}

function updateNodePosition(node) {
  const el = document.getElementById('node-' + node.id);
  if (el) {
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';
  }
}

function startDragNode(e, nodeId) {
  e.stopPropagation();
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;
  selectNode(nodeId);
  state.drag = {
    type: 'node',
    nodeId: nodeId,
    startX: e.clientX,
    startY: e.clientY,
    originX: node.x,
    originY: node.y,
  };
}

// ==================== 连线系统 ====================
// 正向：从输出端口拖出
function startConnecting(fromNode, fromPort, e) {
  state.connecting = { fromNode, fromPort, reverse: false };
  state.drag = {
    type: 'connect',
    startX: e.clientX,
    startY: e.clientY,
  };
  highlightConnectablePorts();
}

// 反向：从输入端口拖出，连到输出端口
function startConnectingReverse(toNode, toPort, e) {
  state.connecting = { toNode, toPort, reverse: true };
  state.drag = {
    type: 'connect',
    startX: e.clientX,
    startY: e.clientY,
  };
  highlightConnectablePorts();
}

// 连线中：高亮所有可作为目标的端口
function highlightConnectablePorts() {
  document.querySelectorAll('.node-port').forEach(p => p.classList.remove('connectable', 'snap'));
  if (!state.connecting) return;
  const dir = state.connecting.reverse ? 'output' : 'input';
  document.querySelectorAll(`.node-port.${dir}`).forEach(p => {
    p.classList.add('connectable');
  });
}

// 屏幕坐标 → 画布坐标
function toCanvasCoords(clientX, clientY) {
  const wrapper = document.getElementById('canvasWrapper');
  const rect = wrapper.getBoundingClientRect();
  return {
    x: (clientX - rect.left - state.canvas.x) / state.canvas.scale,
    y: (clientY - rect.top - state.canvas.y) / state.canvas.scale,
  };
}

// 获取端口中心的画布坐标
function getPortCanvasPos(portEl) {
  const r = portEl.getBoundingClientRect();
  const wrapper = document.getElementById('canvasWrapper');
  const rect = wrapper.getBoundingClientRect();
  return {
    x: (r.left + r.width / 2 - rect.left - state.canvas.x) / state.canvas.scale,
    y: (r.top + r.height / 2 - rect.top - state.canvas.y) / state.canvas.scale,
  };
}

// 找最近的可用目标端口（磁性吸附，阈值60画布像素）
function findSnapPort(mouseCanvas) {
  if (!state.connecting) return null;
  const dir = state.connecting.reverse ? 'output' : 'input';
  let best = null, bestDist = 60;
  document.querySelectorAll(`.node-port.${dir}`).forEach(p => {
    const pos = getPortCanvasPos(p);
    const dist = Math.hypot(pos.x - mouseCanvas.x, pos.y - mouseCanvas.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  });
  return best;
}

function updateTempConnection(e) {
  if (!state.connecting) return;
  const isReverse = state.connecting.reverse;

  // 起点：正向从输出端口出发，反向从输入端口出发
  const anchorSelector = isReverse
    ? `.node-port.input[data-node="${state.connecting.toNode}"][data-port="${state.connecting.toPort}"]`
    : `.node-port.output[data-node="${state.connecting.fromNode}"][data-port="${state.connecting.fromPort}"]`;
  const fromEl = document.querySelector(anchorSelector);
  if (!fromEl) return;

  const p1 = getPortCanvasPos(fromEl);
  const mouse = toCanvasCoords(e.clientX, e.clientY);

  // 磁性吸附：靠近目标端口时自动吸附
  const snapPort = findSnapPort(mouse);
  document.querySelectorAll('.node-port.snap').forEach(p => p.classList.remove('snap'));
  const p2 = snapPort ? getPortCanvasPos(snapPort) : mouse;
  if (snapPort) snapPort.classList.add('snap');

  let pathEl = document.getElementById('temp-connection');
  if (!pathEl) {
    pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.id = 'temp-connection';
    pathEl.classList.add('connection-path', 'temp');
    document.getElementById('connectionsSvg').appendChild(pathEl);
  }
  // 反向时曲线从鼠标指向输入端口
  const d = isReverse ? createPath(p2.x, p2.y, p1.x, p1.y) : createPath(p1.x, p1.y, p2.x, p2.y);
  pathEl.setAttribute('d', d);
}

// 完成一条连接（含校验）
function completeConnection(fromNode, fromPort, toNode, toPort) {
  if (fromNode === toNode) { showToast('不能连接到自身', 'error'); return; }
  const fromType = NODE_TYPES[state.nodes.find(n => n.id === fromNode).type];
  const toType = NODE_TYPES[state.nodes.find(n => n.id === toNode).type];
  if (!fromType || !toType) return;
  if (!fromType.outputs.includes(fromPort) || !toType.inputs.includes(toPort)) {
    showToast('端口类型不匹配', 'error');
    return;
  }
  // 同一输入端口只保留一条连线
  state.connections = state.connections.filter(c => !(c.toNode === toNode && c.toPort === toPort));
  state.connIdCounter++;
  state.connections.push({
    id: 'c' + state.connIdCounter,
    fromNode, fromPort, toNode, toPort,
  });
  showToast('✅ 节点已连接', 'success');
  renderAll();
}

function finishConnecting(e) {
  if (!state.connecting) return;
  const isReverse = state.connecting.reverse;

  // 优先：磁性吸附的端口
  const mouse = toCanvasCoords(e.clientX, e.clientY);
  const snapPort = findSnapPort(mouse);

  let target = snapPort;
  if (!target) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el.classList.contains('node-port')) target = el;
  }

  if (target) {
    const dir = isReverse ? 'output' : 'input';
    if (target.dataset.direction === dir) {
      if (isReverse) {
        completeConnection(target.dataset.node, target.dataset.port, state.connecting.toNode, state.connecting.toPort);
      } else {
        completeConnection(state.connecting.fromNode, state.connecting.fromPort, target.dataset.node, target.dataset.port);
      }
    }
  }

  cancelConnecting();
}

function cancelConnecting() {
  state.connecting = null;
  const temp = document.getElementById('temp-connection');
  if (temp) temp.remove();
  document.querySelectorAll('.node-port.connectable, .node-port.snap').forEach(p => p.classList.remove('connectable', 'snap'));
}

// 重新渲染所有端口状态（连线变化后）
function renderAllPorts() {
  state.nodes.forEach(n => {
    const el = document.getElementById('node-' + n.id);
    if (!el) return;
    const portsWrap = el.querySelectorAll('.node-port');
    const nodeType = NODE_TYPES[n.type];
    nodeType.inputs.forEach((input) => {
      const p = el.querySelector(`.node-port.input[data-port="${input}"]`);
      if (p) p.classList.toggle('connected', state.connections.some(c => c.toNode === n.id && c.toPort === input));
    });
    nodeType.outputs.forEach((output) => {
      const p = el.querySelector(`.node-port.output[data-port="${output}"]`);
      if (p) p.classList.toggle('connected', state.connections.some(c => c.fromNode === n.id && c.fromPort === output));
    });
  });
}

function createPath(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function updateConnections() {
  const svg = document.getElementById('connectionsSvg');
  svg.innerHTML = '';

  // 重设SVG尺寸
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');

  state.connections.forEach(conn => {
    const fromEl = document.querySelector(`.node-port.output[data-node="${conn.fromNode}"][data-port="${conn.fromPort}"]`);
    const toEl = document.querySelector(`.node-port.input[data-node="${conn.toNode}"][data-port="${conn.toPort}"]`);
    if (!fromEl || !toEl) return;

    const wrapper = document.getElementById('canvasWrapper');
    const rect = wrapper.getBoundingClientRect();
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    const x1 = (fromRect.left + fromRect.width / 2 - rect.left - state.canvas.x) / state.canvas.scale;
    const y1 = (fromRect.top + fromRect.height / 2 - rect.top - state.canvas.y) / state.canvas.scale;
    const x2 = (toRect.left + toRect.width / 2 - rect.left - state.canvas.x) / state.canvas.scale;
    const y2 = (toRect.top + toRect.height / 2 - rect.top - state.canvas.y) / state.canvas.scale;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('connection-path', 'hit-area');
    path.setAttribute('d', createPath(x1, y1, x2, y2));
    path.setAttribute('data-conn-id', conn.id);
    path.style.stroke = 'transparent';
    path.style.strokeWidth = '14';
    path.style.pointerEvents = 'stroke';
    path.style.cursor = 'pointer';
    path.style.fill = 'none';

    // 可见路径
    const visiblePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    visiblePath.classList.add('connection-path', 'visible');
    visiblePath.setAttribute('d', createPath(x1, y1, x2, y2));
    visiblePath.setAttribute('data-conn-id', conn.id);
    visiblePath.style.pointerEvents = 'none';

    path.addEventListener('click', (e) => {
      e.stopPropagation();
      selectConnection(conn.id);
    });
    path.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showConnectionContextMenu(e, conn.id);
    });

    svg.appendChild(visiblePath);
    svg.appendChild(path);
  });
}

function selectConnection(connId) {
  state.connections.forEach(c => {
    const path = document.querySelector(`path.visible[data-conn-id="${c.id}"]`);
    if (path) path.classList.toggle('selected', c.id === connId);
  });
  state.selectedConn = connId;
  state.selectedNode = null;
  document.querySelectorAll('.node').forEach(el => el.classList.remove('selected'));
}

function deleteConnection(connId) {
  const idx = state.connections.findIndex(c => c.id === connId);
  if (idx === -1) return;
  state.connections.splice(idx, 1);
  if (state.selectedConn === connId) state.selectedConn = null;
  updateConnections();
  showToast('连线已删除', 'info');
}

function clearCanvas() {
  if (state.nodes.length === 0) {
    showToast('画布已经是空的', 'info');
    return;
  }
  if (!confirm(`确定要清空画布吗？将删除 ${state.nodes.length} 个节点和 ${state.connections.length} 条连线。`)) return;
  state.nodes = [];
  state.connections = [];
  state.selectedNode = null;
  state.selectedConn = null;
  document.getElementById('canvasContent').querySelectorAll('.node').forEach(el => el.remove());
  updateConnections();
  closeProps();
  showToast('画布已清空', 'success');
}

// ==================== 选择/属性面板 ====================
function selectNode(nodeId) {
  state.nodes.forEach(n => {
    const el = document.getElementById('node-' + n.id);
    if (el) el.classList.toggle('selected', n.id === nodeId);
  });
  state.selectedNode = nodeId;
}

function deselectAll() {
  state.nodes.forEach(n => {
    const el = document.getElementById('node-' + n.id);
    if (el) el.classList.remove('selected');
  });
  state.selectedNode = null;
  state.connections.forEach(c => {
    document.querySelectorAll(`path.visible[data-conn-id="${c.id}"]`).forEach(p => p.classList.remove('selected'));
  });
  state.selectedConn = null;
}

function openProps(nodeId) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const nodeType = NODE_TYPES[node.type];
  selectNode(nodeId);

  const panel = document.getElementById('propsPanel');
  document.getElementById('propsIcon').innerHTML = `<div class="node-icon" style="background:${nodeType.color}22;">${nodeType.icon}</div>`;
  document.getElementById('propsTitle').textContent = nodeType.name;
  document.getElementById('propsBody').innerHTML = addSyncFieldsToPropsHtml(renderPropsForm(node));
  document.getElementById('propsActions').style.display = 'flex';
  bindPropsSync(nodeId);
  panel.classList.add('show');
}

function closeProps() {
  syncPropsToNode(state.selectedNode);
  document.getElementById('propsPanel').classList.remove('show');
  document.getElementById('propsActions').style.display = 'none';
  const body = document.getElementById('propsBody');
  if (body && body._syncHandler) {
    body.removeEventListener('input', body._syncHandler);
    body.removeEventListener('change', body._syncHandler);
    body._syncHandler = null;
  }
  state.selectedNode = null;
  document.querySelectorAll('.node').forEach(el => el.classList.remove('selected'));
}

function saveNodeProps() {
  syncPropsToNode(state.selectedNode);
  closeProps();
}

function deleteSelectedNodeFromProps() {
  if (state.selectedNode) {
    deleteNode(state.selectedNode);
  }
  closeProps();
}

// 把右侧属性面板当前值同步回 node.data
function syncPropsToNode(nodeId) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const d = node.data;
  document.querySelectorAll('#propsBody [data-sync-field]').forEach(el => {
    const field = el.dataset.syncField;
    let value = el.value;
    if (field === 'cameraControl') value = value === 'true';
    else if (['sceneCount','seed','fps'].includes(field)) value = parseInt(value, 10) || 0;
    else if (field === 'strength') value = parseFloat(value) || 0.5;
    d[field] = value;
  });
  refreshNodeBody(node);
}

// 给 renderPropsForm 生成的 HTML 统一注入 data-sync-field，使右侧属性修改能自动同步回 node.data
function addSyncFieldsToPropsHtml(html) {
  return html.replace(/\bid="prop-([^"]+)"/g, 'id="prop-$1" data-sync-field="$1"');
}

// 绑定属性面板实时同步事件
function bindPropsSync(nodeId) {
  const body = document.getElementById('propsBody');
  if (body._syncHandler) {
    body.removeEventListener('input', body._syncHandler);
    body.removeEventListener('change', body._syncHandler);
  }
  const handler = function(e) {
    const target = e.target;
    const field = target.dataset.syncField;
    if (!field) return;
    // textarea 只在 change 时同步，避免输入过程中频繁重绘节点导致失焦
    if (e.type === 'input' && target.tagName === 'TEXTAREA') return;
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    let value = target.value;
    if (field === 'cameraControl') value = value === 'true';
    else if (['sceneCount','seed','fps'].includes(field)) value = parseInt(value, 10) || 0;
    else if (field === 'strength') value = parseFloat(value) || 0.5;
    node.data[field] = value;
    refreshNodeBody(node);
  };
  body.addEventListener('input', handler);
  body.addEventListener('change', handler);
  body._syncHandler = handler;
}

function renderPropsForm(node) {
  const d = node.data;
  let html = '';

  if (node.type === 'script') {
    html = `
      <div class="props-field"><label>📖 故事大纲</label><textarea id="prop-story" rows="4">${d.story}</textarea></div>
      <div class="props-field"><label>🎭 剧集类型</label>
        <select id="prop-genre">
          ${['古风言情','都市悬疑','武侠热血','科幻冒险','校园青春','恐怖悬疑','美食励志','机甲战斗'].map(g => `<option ${g===d.genre?'selected':''}>${g}</option>`).join('')}
        </select>
      </div>
      <div class="props-field"><label>⏱️ 视频时长</label>
        <select id="prop-duration">${['30秒','60秒','90秒','3分钟','5分钟'].map(t => `<option ${t===d.duration?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="props-field"><label>🎬 分镜数量</label>
        <select id="prop-sceneCount">${[4,6,8,10,12,15,20].map(n => `<option value="${n}" ${n==d.sceneCount?'selected':''}>${n}个分镜</option>`).join('')}</select>
      </div>
      <div class="props-field"><label>🎨 动漫风格</label>
        <select id="prop-style">${['日漫风','国漫风','韩漫风','美漫风','水彩风','写实风'].map(s => `<option ${s===d.style?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div class="props-field"><label>🤖 脚本模型</label>
        <select id="prop-model">${['qwen','gpt','claude','deepseek'].map(m => `<option ${m===d.model?'selected':''}>${m}</option>`).join('')}</select>
      </div>
    `;
  } else if (node.type === 'character') {
    html = `
      <div class="props-field"><label>👤 角色名称</label><input id="prop-name" value="${d.name}"></div>
      <div class="props-field"><label>📝 外貌描述</label><textarea id="prop-description" rows="3">${d.description}</textarea></div>
      <div class="props-field"><label>🎨 画风</label>
        <select id="prop-style">${['anime','realistic','gufeng','cyberpunk','watercolor'].map(s => `<option ${s===d.style?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div class="props-field"><label>📐 视图类型</label>
        <select id="prop-views">${['three-view','front','multi-angle','expression-sheet'].map(v => `<option ${v===d.views?'selected':''}>${v}</option>`).join('')}</select>
      </div>
      <div class="props-field"><label>🖼️ 画面比例</label>
        <select id="prop-ratio">${ratioOptionsHTML(d.ratio)}</select>
      </div>
      <div class="props-field"><label>🤖 生成模型</label>
        <select id="prop-model">${['flux','sd','ideogram','qwen'].map(m => `<option ${m===d.model?'selected':''}>${m}</option>`).join('')}</select>
      </div>
    `;
  } else if (node.type === 'imageGen') {
    html = `
      <div class="props-field"><label>🤖 图像模型</label>
        <select id="prop-model">${['flux','sd','ideogram','qwen','nanoBanana'].map(m => `<option ${m===d.model?'selected':''}>${m}</option>`).join('')}${customApiImageOption(d.model)}</select>
      </div>
      <div class="props-field"><label>🎨 画风</label>
        <select id="prop-style">${['anime','realistic','gufeng','cyberpunk','watercolor','oil'].map(s => `<option ${s===d.style?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div class="props-field"><label>📐 画幅比例</label>
        <select id="prop-ratio">${ratioOptionsHTML(d.ratio)}</select>
      </div>
      <div class="props-field"><label>📏 画质</label>
        <select id="prop-quality">${['standard','high','ultra'].map(q => `<option ${q===d.quality?'selected':''}>${q}</option>`).join('')}</select>
      </div>
      <div class="props-field"><label>📷 摄像机控制</label>
        <select id="prop-cameraControl"><option value="true" ${d.cameraControl?'selected':''}>开启</option><option value="false" ${!d.cameraControl?'selected':''}>关闭</option></select>
      </div>
      <div class="props-field"><label>📝 提示词前缀（可选）</label><textarea id="prop-promptPrefix" rows="2">${d.promptPrefix}</textarea></div>
    `;
  } else if (node.type === 'textToImage') {
    html = `
      <div class="props-field"><label>🎨 画面描述</label><textarea id="prop-prompt" rows="4">${d.prompt}</textarea></div>
      <div class="props-field"><label>🖼️ 风格</label>
        <select id="prop-style">${['anime','realistic','gufeng','cyberpunk','watercolor','oil'].map(s => `<option ${s===d.style?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div class="props-field"><label>📐 画面比例</label>
        <select id="prop-ratio">${ratioOptionsHTML(d.ratio)}</select>
      </div>
    `;
  } else if (node.type === 'imageToImage') {
    html = `
      <div class="props-field"><label>🎨 转换描述</label><textarea id="prop-prompt" rows="3">${d.prompt}</textarea></div>
      <div class="props-field"><label>🖼️ 风格</label>
        <select id="prop-style">${['anime','realistic','gufeng','cyberpunk','watercolor'].map(s => `<option ${s===d.style?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div class="props-field"><label>🔄 转换强度: ${d.strength}</label><input type="range" id="prop-strength" min="0.1" max="1" step="0.1" value="${d.strength}" oninput="this.previousElementSibling.querySelector('span')?this.previousElementSibling.querySelector('span').textContent=this.value:null;document.querySelector('label[for=\"strength\"]').textContent='🔄 转换强度: '+this.value"></div>
      <div class="props-field"><label>📐 画面比例</label>
        <select id="prop-ratio">${ratioOptionsHTML(d.ratio)}</select>
      </div>
    `;
  } else if (node.type === 'videoGen') {
    html = `
      <div class="props-field"><label>🎬 视频模型</label>
        <select id="prop-model">
          ${[
            { v: 'toter-rumeng', l: '🌟 入梦 Flash (Toter网关·视频)' },
            { v: 'seedance2', l: '🚀 Seedance 2.0 (豆包·最强画质)' },
            { v: 'seedance2-fast', l: '⚡ Seedance 2.0 Fast (豆包·快速)' },
            { v: 'doubao-pro', l: '🔥 Doubao-Seedance Pro 1.0 (豆包·高质量)' },
            { v: 'doubao-lite', l: '⚡ Doubao-Seedance Lite (豆包·快速)' },
            { v: 'seedance', l: '🎬 Seedance Pro (豆包·兼容)' },
          ].map(m => `<option value="${m.v}" ${m.v===d.model?'selected':''}>${m.l}</option>`).join('')}${customApiVideoOption(d.model)}
        </select>
      </div>
      <div class="props-field"><label>⏱️ 视频时长</label>
        <select id="prop-duration">${['5秒','8秒','10秒','15秒'].map(t => `<option ${t===d.duration?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="props-field"><label>📐 画幅比例</label>
        <select id="prop-aspectRatio">${ratioOptionsHTML(d.aspectRatio)}</select>
      </div>
      <div class="props-field"><label>🎬 运动强度</label>
        <select id="prop-motion">${['low','medium','high'].map(m => `<option ${m===d.motion?'selected':''}>${m}</option>`).join('')}</select>
      </div>
      <div class="props-field"><label>📝 运动描述（可选）</label><textarea id="prop-prompt" rows="2">${d.prompt}</textarea></div>
      <div class="props-field"><label>🎲 随机种子（-1=随机）</label><input type="number" id="prop-seed" value="${d.seed}" min="-1"></div>
    `;
  } else if (node.type === 'textToVideo') {
    html = `
      <div class="props-field"><label>🎬 视频模型</label>
        <select id="prop-model">
          ${[
            { v: 'toter-rumeng', l: '🌟 入梦 Flash (Toter网关·视频)' },
            { v: 'seedance2', l: '🚀 Seedance 2.0 (豆包·最强画质)' },
            { v: 'seedance2-fast', l: '⚡ Seedance 2.0 Fast (豆包·快速)' },
            { v: 'doubao-pro', l: '🔥 Doubao-Seedance Pro 1.0 (豆包·高质量)' },
            { v: 'doubao-lite', l: '⚡ Doubao-Seedance Lite (豆包·快速)' },
            { v: 'seedance', l: '🎬 Seedance Pro (豆包·兼容)' },
          ].map(m => `<option value="${m.v}" ${m.v===d.model?'selected':''}>${m.l}</option>`).join('')}${customApiVideoOption(d.model)}
        </select>
      </div>
      <div class="props-field"><label>🎥 视频描述</label><textarea id="prop-prompt" rows="4">${d.prompt}</textarea></div>
      <div class="props-field"><label>⏱️ 视频时长</label>
        <select id="prop-duration">${['5秒','8秒','10秒','15秒'].map(t => `<option ${t===d.duration?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="props-field"><label>📐 画幅比例</label>
        <select id="prop-aspectRatio">${ratioOptionsHTML(d.aspectRatio)}</select>
      </div>
      <div class="props-field"><label>🎬 风格</label>
        <select id="prop-style">${['cinematic','anime','documentary','mv'].map(s => `<option ${s===d.style?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div class="props-field"><label>🎲 随机种子（-1=随机）</label><input type="number" id="prop-seed" value="${d.seed}" min="-1"></div>
    `;
  } else if (node.type === 'music') {
    html = `
      <div class="props-field"><label>🎵 音乐风格</label>
        <select id="prop-style">${['古风','流行','电子','摇滚','古典','爵士','民谣'].map(s => `<option ${s===d.style?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div class="props-field"><label>💭 情绪</label>
        <select id="prop-mood">${['浪漫','激昂','悲伤','欢乐','神秘','紧张','治愈'].map(m => `<option ${m===d.mood?'selected':''}>${m}</option>`).join('')}</select>
      </div>
      <div class="props-field"><label>⏱️ 时长</label>
        <select id="prop-duration">${['30秒','60秒','2分钟','3分钟','4分钟'].map(t => `<option ${t===d.duration?'selected':''}>${t}</option>`).join('')}</select>
      </div>
    `;
  } else if (node.type === 'export') {
    html = `
      <div class="props-field"><label>📦 输出格式</label>
        <select id="prop-format">${['MP4','MOV','WebM'].map(f => `<option ${f===d.format?'selected':''}>${f}</option>`).join('')}</select>
      </div>
      <div class="props-field"><label>📐 分辨率</label>
        <select id="prop-resolution">${['1080x1920','1920x1080','720x1280','3840x2160'].map(r => `<option ${r===d.resolution?'selected':''}>${r}</option>`).join('')}</select>
      </div>
      <div class="props-field"><label>🎞️ 帧率</label>
        <select id="prop-fps">${[24,30,60].map(f => `<option value="${f}" ${f==d.fps?'selected':''}>${f}fps</option>`).join('')}</select>
      </div>
    `;
  }

  html += `
    <div style="display:flex;gap:8px;margin-top:20px;">
      <button class="node-btn primary" onclick="saveProps('${node.id}')">💾 保存</button>
      <button class="node-btn" style="color:var(--accent-red);" onclick="deleteNode('${node.id}')">🗑️ 删除节点</button>
    </div>
  `;

  return html;
}

function saveProps(nodeId) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;

  // 收集所有属性
  document.querySelectorAll('.props-field input, .props-field textarea, .props-field select').forEach(el => {
    const key = el.id.replace('prop-', '');
    let value = el.value;
    if (el.type === 'number' || key === 'sceneCount' || key === 'fps') value = parseInt(value);
    if (key === 'strength') value = parseFloat(value);
    if (key === 'cameraControl') value = value === 'true';
    node.data[key] = value;
  });

  // 重新渲染节点（保持尺寸不变）
  refreshNodeBody(node);

  showToast('属性已保存', 'success');
}

// ==================== 节点执行 ====================
async function executeNode(nodeId) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;

  const btn = document.getElementById('btn-' + nodeId);
  const statusEl = document.getElementById('status-' + nodeId);

  // 设置处理状态
  node.status = 'processing';
  if (btn) { btn.classList.add('loading'); btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> 生成中...'; }
  if (statusEl) { statusEl.className = 'node-status processing'; statusEl.textContent = '生成中'; }

  const nodeEl = document.getElementById('node-' + nodeId);
  if (nodeEl) nodeEl.classList.add('processing');

  try {
    switch (node.type) {
      case 'script':
        node.output = await executeScriptNode(node);
        break;
      case 'character':
        node.output = await executeCharacterNode(node);
        break;
      case 'imageGen':
        node.outputs.images = await executeImageGenNode(node);
        break;
      case 'textToImage':
        node.output = await executeTextToImageNode(node);
        break;
      case 'imageToImage':
        node.output = await executeImageToImageNode(node);
        break;
      case 'videoGen':
        node.outputs.videos = await executeVideoGenNode(node);
        break;
      case 'textToVideo':
        node.output = await executeTextToVideoNode(node);
        break;
      case 'music':
        node.output = await executeMusicNode(node);
        break;
      case 'export':
        node.output = await executeExportNode(node);
        break;
    }

    node.status = 'done';
    if (statusEl) { statusEl.className = 'node-status done'; statusEl.textContent = '已完成'; }
    showToast(`${NODE_TYPES[node.type].name} 生成完成！`, 'success');

    // 记录到作品库
    addToGallery(node);

    // 自动更新下游节点
    updateDownstreamNodes(nodeId);

  } catch (error) {
    node.status = 'error';
    if (statusEl) { statusEl.className = 'node-status error'; statusEl.textContent = '失败'; }
    showToast(`生成失败: ${error.message}`, 'error');
  } finally {
    if (btn) { btn.classList.remove('loading'); btn.disabled = false; btn.innerHTML = getButtonText(node.type); }
    if (nodeEl) nodeEl.classList.remove('processing');

    // 重新渲染节点体（保持节点尺寸不变）
    refreshNodeBody(node);
  }
}

function getButtonText(type) {
  const map = {
    script: '⚡ 生成脚本',
    character: '⚡ 生成角色图',
    imageGen: '⚡ 生成分镜图',
    textToImage: '⚡ 生成图片',
    imageToImage: '⚡ 转换图片',
    videoGen: '⚡ 生成视频',
    textToVideo: '⚡ 生成视频',
    music: '🎵 生成音乐',
    export: '📤 合成成片',
  };
  return map[type] || '⚡ 执行';
}

// ==================== AI生成逻辑 ====================

// 脚本生成
async function executeScriptNode(node) {
  const d = node.data;
  // 生成结构化分镜脚本
  await sleep(2000);

  const scenes = [];
  const sceneCount = d.sceneCount;
  const storyParts = splitStory(d.story, sceneCount);

  const shots = ['特写', '近景', '中景', '全景', '远景', '俯拍', '仰拍', '跟拍', '推镜头', '拉镜头'];
  const emotions = ['温柔', '紧张', '激动', '平静', '悲伤', '喜悦', '愤怒', '惊讶', '沉思', '坚定'];

  for (let i = 0; i < sceneCount; i++) {
    scenes.push({
      num: i + 1,
      shot: shots[i % shots.length],
      description: storyParts[i] || `第${i+1}镜：${d.story.substring(0, 20)}...`,
      emotion: emotions[i % emotions.length],
      duration: Math.ceil(60 / sceneCount) + '秒',
      dialogue: i < sceneCount / 2 ? `台词${i+1}：...` : '',
      prompt: generateScenePrompt(storyParts[i] || d.story, d.style, d.genre),
    });
  }

  return {
    title: generateTitle(d.story, d.genre),
    scenes: scenes,
    raw: d.story,
  };
}

function splitStory(story, count) {
  const parts = [];
  const len = story.length;
  const chunkSize = Math.ceil(len / count);
  for (let i = 0; i < count; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, len);
    if (start < len) {
      parts.push(story.substring(start, end).trim());
    }
  }
  // 如果故事太短，补充场景
  while (parts.length < count) {
    parts.push(`场景${parts.length + 1}：角色互动，推动剧情发展`);
  }
  return parts;
}

function generateTitle(story, genre) {
  const keywords = story.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
  return keywords.slice(0, 3).join('·') || '未命名漫剧';
}

function generateScenePrompt(desc, style, genre) {
  const styleMap = {
    '日漫风': 'anime style, cel shading, vibrant colors, detailed',
    '国漫风': 'Chinese animation style, ink wash, elegant',
    '韩漫风': 'webtoon style, clean lines, soft colors',
    '美漫风': 'American comic style, bold lines, dynamic',
    '水彩风': 'watercolor painting, soft, dreamy',
    '写实风': 'photorealistic, cinematic, detailed',
  };
  const s = styleMap[style] || styleMap['日漫风'];
  return `${desc}, ${s}, ${genre}, high quality, masterpiece, 9:16 vertical`;
}

// 角色生成
async function executeCharacterNode(node) {
  const d = node.data;
  const viewsDesc = {
    'three-view': 'character sheet, front view, side view, back view, full body',
    'front': 'front view, full body character portrait',
    'multi-angle': 'multiple angles, 360 degree character turnaround',
    'expression-sheet': 'expression sheet, multiple facial expressions',
  };
  const prompt = `${d.description}, ${viewsDesc[d.views] || viewsDesc['three-view']}, ${d.style} style, character design, high quality, detailed`;

  try {
    return await callImageGenAPI(prompt, null, d.ratio, d.model);
  } catch (e) {
    return generatePlaceholderImage(prompt, d.ratio);
  }
}

// 分镜图批量生成
async function executeImageGenNode(node) {
  const d = node.data;
  // 获取上游脚本
  const scriptConn = state.connections.find(c => c.toNode === node.id && c.toPort === 'script');
  if (!scriptConn) throw new Error('未连接脚本节点');

  const scriptNode = state.nodes.find(n => n.id === scriptConn.fromNode);
  if (!scriptNode || !scriptNode.output) throw new Error('脚本未生成');

  const scenes = scriptNode.output.scenes;
  const images = [];

  // 获取角色参考
  const charConn = state.connections.find(c => c.toNode === node.id && c.toPort === 'character');
  let charRef = null;
  if (charConn) {
    const charNode = state.nodes.find(n => n.id === charConn.fromNode);
    if (charNode && charNode.output) charRef = charNode.output;
  }

  // 批量生成
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    let prompt = `${d.promptPrefix ? d.promptPrefix + ', ' : ''}${scene.prompt}, ${d.style} style`;
    if (d.cameraControl) prompt += ', professional camera, cinematic lighting';

    try {
      const url = await callImageGenAPI(prompt, charRef, d.ratio, d.model);
      images.push(url);
    } catch (e) {
      images.push(generatePlaceholderImage(prompt, d.ratio));
    }

    // 更新进度
    if (i < scenes.length - 1) await sleep(500);
  }

  return images;
}

// 文生图
async function executeTextToImageNode(node) {
  const d = node.data;
  const styleMap = {
    anime: 'anime style, cel shading, vibrant colors',
    realistic: 'photorealistic, ultra detailed, 8K',
    gufeng: 'Chinese traditional art style, ink wash, oriental',
    cyberpunk: 'cyberpunk, neon lights, futuristic',
    watercolor: 'watercolor painting, soft, dreamy',
    oil: 'oil painting, rich textures, classical',
  };
  const prompt = `${d.prompt}, ${styleMap[d.style] || ''}, high quality, masterpiece`;

  try {
    return await callImageGenAPI(prompt, null, d.ratio, d.model);
  } catch (e) {
    return generatePlaceholderImage(prompt, d.ratio);
  }
}

// 图生图
async function executeImageToImageNode(node) {
  const d = node.data;
  const conn = state.connections.find(c => c.toNode === node.id && c.toPort === 'image');
  if (!conn) throw new Error('未连接输入图片');

  const sourceNode = state.nodes.find(n => n.id === conn.fromNode);
  if (!sourceNode) throw new Error('源节点不存在');

  const sourceImage = sourceNode.output || (sourceNode.outputs.images && sourceNode.outputs.images[0]);
  if (!sourceImage) throw new Error('源图片未生成');

  const styleMap = {
    anime: 'anime style, cel shading',
    realistic: 'photorealistic',
    gufeng: 'Chinese traditional art, ink wash',
    cyberpunk: 'cyberpunk, neon',
    watercolor: 'watercolor',
  };
  const prompt = `${d.prompt}, ${styleMap[d.style] || ''}, strength ${d.strength}`;

  try {
    return await callImageGenAPI(prompt, sourceImage, d.ratio, d.model);
  } catch (e) {
    return generatePlaceholderImage(prompt, d.ratio);
  }
}

// 视频生成（图生视频 - 豆包）
async function executeVideoGenNode(node) {
  const d = node.data;
  const conn = state.connections.find(c => c.toNode === node.id && c.toPort === 'images');
  if (!conn) throw new Error('未连接分镜图');

  const sourceNode = state.nodes.find(n => n.id === conn.fromNode);
  if (!sourceNode || !sourceNode.outputs.images) throw new Error('分镜图未生成');

  const images = sourceNode.outputs.images;
  const videos = [];

  const motionMap = {
    low: 'subtle motion, gentle camera',
    medium: 'smooth motion, dynamic camera',
    high: 'intense motion, dramatic action'
  };
  const motionText = motionMap[d.motion] || motionMap['medium'];
  const prompt = `${d.prompt || motionText}, cinematic, high quality, masterpiece`;

  // 豆包配置选项
  const options = {
    model: d.model || 'doubao-pro',
    duration: parseInt(d.duration) || 5,
    aspectRatio: d.aspectRatio || '9:16',
    seed: d.seed >= 0 ? d.seed : -1,
  };

  showToast(`🎬 豆包视频生成中...（共${images.length}段，每段约${options.duration}秒）`, 'info');

  for (let i = 0; i < images.length; i++) {
    try {
      const result = await callVideoGenAPI(prompt, images[i], options);
      videos.push(result);
      const provider = result.provider === 'doubao' ? '🔥 豆包' : (result.provider === 'fallback' ? '⚡ 占位' : '✅');
      showToast(`${provider} 第 ${i + 1}/${images.length} 段完成`, 'success');
    } catch (e) {
      console.error(`第 ${i + 1} 段视频生成失败:`, e);
      videos.push({
        type: 'animated_thumbnail',
        thumb: images[i],
        url: images[i],
        prompt: prompt,
        duration: '5s',
        provider: 'error',
        error: e.message,
      });
      showToast(`⚠️ 第 ${i + 1} 段失败: ${e.message.substring(0, 50)}`, 'error');
    }

    if (i < images.length - 1) await sleep(500);
  }

  return videos;
}

// 文生视频（豆包）
async function executeTextToVideoNode(node) {
  const d = node.data;
  const styleMap = {
    cinematic: 'cinematic, movie quality, dramatic lighting',
    anime: 'anime style, dynamic animation, vibrant',
    documentary: 'documentary style, natural, real life',
    mv: 'music video style, dynamic camera, fast cuts',
  };
  const prompt = `${d.prompt}, ${styleMap[d.style] || ''}`;

  const options = {
    model: d.model || 'doubao-pro',
    duration: parseInt(d.duration) || 5,
    aspectRatio: d.aspectRatio || '9:16',
    seed: d.seed >= 0 ? d.seed : -1,
  };

  try {
    return await callVideoGenAPI(prompt, null, options);
  } catch (e) {
    const seed = options.seed >= 0 ? options.seed : Math.floor(Math.random() * 1000000);
    const encodedPrompt = encodeURIComponent(prompt.substring(0, 300));
    const [thumbW, thumbH] = ratioToSize(options.aspectRatio);
    const thumbUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${thumbW}&height=${thumbH}&seed=${seed}&nologo=true`;
    return {
      type: 'animated_thumbnail',
      thumb: thumbUrl,
      url: thumbUrl,
      prompt: prompt,
      duration: d.duration,
      provider: 'fallback',
      error: e.message,
    };
  }
}

// 音乐生成
async function executeMusicNode(node) {
  const d = node.data;
  await sleep(2000);
  // 返回一个占位
  return `🎵 ${d.style}风格 · ${d.mood}情绪 · ${d.duration}`;
}

// 导出合成
async function executeExportNode(node) {
  const videoConn = state.connections.find(c => c.toNode === node.id && c.toPort === 'videos');
  const audioConn = state.connections.find(c => c.toNode === node.id && c.toPort === 'audio');

  if (!videoConn) throw new Error('未连接视频');

  const videoNode = state.nodes.find(n => n.id === videoConn.fromNode);
  if (!videoNode) throw new Error('视频节点不存在');

  const videos = videoNode.outputs.videos || [];
  const audio = audioConn ? state.nodes.find(n => n.id === audioConn.fromNode)?.output : null;

  await sleep(2000);

  return {
    format: node.data.format,
    resolution: node.data.resolution,
    videoCount: videos.length,
    hasAudio: !!audio,
    status: '合成完成',
  };
}

// ==================== AI API调用 ====================
// 使用 Pollinations.ai 免费AI文生图服务（无需API Key，直接返回真实AI图片）
async function callImageGenAPI(prompt, referenceImage, ratio, model) {
  // 如果有外部回调（如WorkBuddy注入），优先使用
  if (window._imageGenCallback) {
    return new Promise((resolve, reject) => {
      window._imageGenCallback({
        prompt,
        referenceImage,
        ratio,
        onSuccess: resolve,
        onError: reject,
      });
    });
  }

  // 自定义 API（图片类型）
  if (model === 'custom-api' && state.customApiConfig.enabled && state.customApiConfig.type === 'image') {
    return await callCustomImageAPI(prompt, referenceImage, ratio);
  }

  // 豆包图片生成 (Doubao-Seedream) —— 启用且已配置 Key 时走云端，失败回退免费服务
  if (state.doubaoConfig.enabled && state.doubaoConfig.apiKey) {
    try {
      return await callDoubaoImageAPI(prompt, referenceImage, ratio);
    } catch (e) {
      console.error('[豆包图片] 生成失败，回退 Pollinations 免费服务：', e);
      showToast && showToast('⚠️ 豆包图片生成失败：' + (e && e.message ? e.message : e) + '，已回退免费服务', 'error');
    }
  }

  // 使用 Pollinations.ai 免费生成真实AI图片
  const seed = Math.floor(Math.random() * 1000000);
  // 简化prompt，确保不会太长
  const cleanPrompt = prompt.substring(0, 300).replace(/#/g, '');
  const encodedPrompt = encodeURIComponent(cleanPrompt);
  const [imgW, imgH] = ratioToSize(ratio);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${imgW}&height=${imgH}&seed=${seed}&nologo=true`;

  // 预加载图片，确保URL有效（浏览器会自动发送User-Agent）
  return new Promise((resolve, reject) => {
    const img = new Image();
    let resolved = false;
    // 30秒超时
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        // 超时也返回URL，让浏览器慢慢加载
        resolve(imageUrl);
      }
    }, 30000);

    img.onload = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(imageUrl);
      }
    };
    img.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        // 失败也返回URL，img标签会显示alt文本
        resolve(imageUrl);
      }
    };
    img.src = imageUrl;
  });
}

// ==================== 豆包视频生成 API ====================
// 火山引擎豆包视频生成 (Doubao-Seedance / Doubao-1.5-pro)
// 文档: https://www.volcengine.com/docs/82379
async function callVideoGenAPI(prompt, referenceImage, options = {}) {
  // 1) 优先使用 WorkBuddy 注入的视频生成回调
  if (window._videoGenCallback) {
    return new Promise((resolve, reject) => {
      window._videoGenCallback({
        prompt,
        referenceImage,
        options,
        onSuccess: resolve,
        onError: reject,
      });
    });
  }

  // 1.5) 本地 ComfyUI (Wan2.2) 模型分支 —— 需要用户已在顶栏配置 ComfyUI 并启用
  if (options.model && typeof isWan22Model === 'function' && isWan22Model(options.model)) {
    try {
      return await generateWithComfyUI(options.model, prompt, referenceImage, options);
    } catch (e) {
      console.error('[ComfyUI] Wan2.2 生成失败，回退占位预览：', e);
      showToast('⚠️ Wan2.2 本地 ComfyUI 生成失败：' + (e && e.message ? e.message : e) + '，已回退占位预览', 'error');
      return await fallbackVideoGen(prompt, referenceImage, options);
    }
  }

  // 2) 使用 Toter 聚合网关 (含「入梦 Flash」视频模型)
  if (options.model === 'toter-rumeng' && state.toterConfig.enabled && state.toterConfig.apiKey) {
    return await callToterVideoAPI(prompt, referenceImage, options);
  }

  // 2.5) 使用用户自定义 API（视频类型）
  if (options.model === 'custom-api' && state.customApiConfig.enabled && state.customApiConfig.type === 'video') {
    return await callCustomVideoAPI(prompt, referenceImage, options);
  }

  // 3) 使用豆包 / 火山引擎 API (需要配置 API Key)
  if (state.doubaoConfig.enabled && state.doubaoConfig.apiKey) {
    return await callDoubaoVideoAPI(prompt, referenceImage, options);
  }

  // 4) 回退方案：生成关键帧 + 动画占位
  return await fallbackVideoGen(prompt, referenceImage, options);
}

// 豆包视频生成 - 异步任务模式
async function callDoubaoVideoAPI(prompt, referenceImage, options = {}) {
  const model = options.model || 'doubao-pro';
  const duration = parseInt(options.duration) || 5; // 5/10
  const ratio = options.aspectRatio || '9:16';

  // 豆包视频生成支持的模型：
  // - Doubao-Seedance-2.0 (新一代多模态创作, 4-15秒, 480p/720p/1080p/4k)
  // - Doubao-Seedance-2.0-fast (快速版)
  // - Doubao-Seedance-1.0-pro (高质量)
  // - Doubao-Seedance-1.0-lite-i2v (图生视频)
  // - Doubao-Seedance-1.0-lite-t2v (文生视频)
  const isSeedance2 = model === 'seedance2' || model === 'seedance2-fast';
  const modelMap = {
    'seedance2': 'doubao-seedance-2-0-260128',
    'seedance2-fast': 'doubao-seedance-2-0-fast-260128',
    'doubao-pro': referenceImage
      ? 'doubao-seedance-1-0-pro-250528'        // Pro: 支持图生视频
      : 'doubao-seedance-1-0-pro-250528',       // 文生视频也用Pro
    'doubao-lite': referenceImage
      ? 'doubao-seedance-1-0-lite-i2v-250428'
      : 'doubao-seedance-1-0-lite-t2v-250428',
    'seedance': 'doubao-seedance-1-0-pro-250528',
  };
  const actualModel = modelMap[model] || modelMap['doubao-pro'];

  // 文生视频 vs 图生视频 路径
  const url = referenceImage
    ? `${state.doubaoConfig.endpoint}/contents/generations/tasks`   // 图生视频
    : `${state.doubaoConfig.endpoint}/contents/generations/tasks`;  // 文生视频

  // 构建请求体
  const requestBody = {
    model: actualModel,
    content: []
  };

  if (referenceImage) {
    // 图生视频：图片 + 文本提示
    requestBody.content.push({
      type: 'image_url',
      image_url: { url: referenceImage }
    });
  }

  requestBody.content.push({
    type: 'text',
    text: prompt + ', cinematic, high quality, masterpiece'
  });

  // 参数（Seedance 2.0 用 ratio/resolution 格式；1.0 用 widthxheight）
  const params = [];
  let seedance2Duration = 0;
  if (duration) {
    if (isSeedance2) {
      // Seedance 2.0: 4~15 秒
      seedance2Duration = Math.min(15, Math.max(4, duration));
      params.push(`--duration ${seedance2Duration}`);
    } else {
      // Seedance 1.0 系列: 仅支持 5 / 10 秒，自动取就近值
      const d10 = duration >= 8 ? 10 : 5;
      params.push(`--duration ${d10}`);
    }
  }
  if (ratio) {
    if (isSeedance2) {
      // Seedance 2.0 原生支持比例字符串: 21:9 16:9 4:3 1:1 3:4 9:16
      params.push(`--ratio ${ratio}`);
      params.push('--resolution 720p');
    } else {
      const ratioMap = {
        '9:16': '720x1280', '16:9': '1280x720', '1:1': '960x960',
        '3:4': '720x960', '4:3': '960x720', '21:9': '1344x576',
        '2:3': '832x1248', '3:2': '1248x832',
      };
      params.push(`--ratio ${ratioMap[ratio] || '720x1280'}`);
    }
  }
  if (options.seed && options.seed >= 0) params.push(`--seed ${options.seed}`);

  requestBody.parameters = {};
  if (params.length > 0) {
    // 把参数转为对象形式
    params.forEach(p => {
      const [k, v] = p.replace('--', '').split(' ');
      requestBody.parameters[k] = isNaN(v) ? v : parseInt(v);
    });
    // Seedance 2.0: 参数同时以 --flag 形式附加到提示词文本，确保两种传参方式都被识别
    if (isSeedance2) {
      const textItem = requestBody.content.find(c => c.type === 'text');
      if (textItem) textItem.text += ' ' + params.join(' ');
    }
  }

  try {
    // 步骤1：创建任务（走本地代理，避免浏览器 CORS 拦截）
    const createRes = await proxyFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.doubaoConfig.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`豆包API创建任务失败 (${createRes.status}): ${errText.substring(0, 200)}`);
    }

    const taskData = await createRes.json();
    const taskId = taskData.id;
    if (!taskId) throw new Error('豆包API未返回任务ID: ' + JSON.stringify(taskData));

    // 步骤2：轮询任务状态
    const taskUrl = `${state.doubaoConfig.endpoint}/contents/generations/tasks/${taskId}`;
    let videoUrl = null;
    let attempts = 0;
    const maxAttempts = isSeedance2 ? 84 : 60; // 2.0 生成较慢，最多轮询84次 (7分钟)

    while (attempts < maxAttempts) {
      await sleep(5000); // 每5秒查一次

      const pollRes = await proxyFetch(taskUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${state.doubaoConfig.apiKey}` }
      });

      if (!pollRes.ok) {
        attempts++;
        continue;
      }

      const pollData = await pollRes.json();
      const status = pollData.status;

      // queued / running / succeeded / failed / cancelled
      if (status === 'succeeded' || status === 'success') {
        // 提取视频URL - 豆包API视频URL通常在 content.video_url 或 content[0].video_url
        videoUrl = pollData.content?.video_url
          || pollData.content?.[0]?.video_url
          || pollData.video_url;
        if (!videoUrl) throw new Error('豆包任务完成但未返回视频URL: ' + JSON.stringify(pollData));
        break;
      } else if (status === 'failed' || status === 'cancelled') {
        throw new Error(`豆包任务${status === 'failed' ? '失败' : '已取消'}: ${pollData.error?.message || JSON.stringify(pollData)}`);
      }
      attempts++;
    }

    if (!videoUrl) throw new Error('豆包视频生成超时，请稍后再试');

    return {
      type: 'mp4_video',
      url: videoUrl,
      thumb: referenceImage || null,
      prompt: prompt,
      duration: duration + 's',
      provider: 'doubao',
      model: actualModel,
    };

  } catch (e) {
    console.error('豆包视频生成失败:', e);
    throw e;
  }
}

// 豆包图片生成 (Doubao-Seedream 3.0) —— 与视频共用 /contents/generations/tasks 异步接口
// t2i: doubeo-seedream-3-0-t2i-260315  |  i2i: doubeo-seedream-3-0-i2i-260315
async function callDoubaoImageAPI(prompt, referenceImage, ratio) {
  const t2iModel = 'doubao-seedream-3-0-t2i-260315';
  const i2iModel = 'doubao-seedream-3-0-i2i-260315';
  const model = referenceImage ? i2iModel : t2iModel;
  const url = `${state.doubaoConfig.endpoint}/contents/generations/tasks`;

  const [imgW, imgH] = ratioToSize(ratio || '9:16');
  const content = [];
  if (referenceImage) {
    content.push({ type: 'image_url', image_url: { url: referenceImage } });
  }
  content.push({ type: 'text', text: prompt });

  const requestBody = {
    model,
    content,
    parameters: { size: `${imgW}x${imgH}` },
  };

  // 步骤1：创建任务（走本地代理，避免浏览器 CORS 拦截）
  const createRes = await proxyFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.doubaoConfig.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`豆包图片API创建任务失败 (${createRes.status}): ${errText.substring(0, 300)}`);
  }

  const taskData = await createRes.json();
  const taskId = taskData.id;
  if (!taskId) throw new Error('豆包图片API未返回任务ID: ' + JSON.stringify(taskData));

  // 步骤2：轮询任务状态
  const taskUrl = `${state.doubaoConfig.endpoint}/contents/generations/tasks/${taskId}`;
  let imageUrl = null;
  let attempts = 0;
  const maxAttempts = 30; // 图片生成较快，最多轮询30次 (约2.5分钟)

  while (attempts < maxAttempts) {
    await sleep(5000);
    const pollRes = await proxyFetch(taskUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${state.doubaoConfig.apiKey}` },
    });
    if (!pollRes.ok) { attempts++; continue; }

    const pollData = await pollRes.json();
    const status = pollData.status;

    if (status === 'succeeded' || status === 'success') {
      // Seedream 结果可能在 content[].image_url.url 或顶层 image_urls
      if (Array.isArray(pollData.content) && pollData.content.length) {
        imageUrl = pollData.content[0]?.image_url?.url
          || pollData.content[0]?.url
          || null;
      }
      if (!imageUrl && Array.isArray(pollData.image_urls) && pollData.image_urls.length) {
        imageUrl = pollData.image_urls[0];
      }
      if (!imageUrl) throw new Error('豆包图片任务完成但未返回图片URL: ' + JSON.stringify(pollData));
      break;
    } else if (status === 'failed' || status === 'cancelled') {
      throw new Error(`豆包图片任务${status === 'failed' ? '失败' : '已取消'}: ${pollData.error?.message || JSON.stringify(pollData)}`);
    }
    attempts++;
  }

  if (!imageUrl) throw new Error('豆包图片生成超时，请稍后再试');
  return imageUrl;
}

// Toter 聚合网关视频生成 (New API 网关，模型「入梦 Flash」)
// 走 OpenAI 兼容视频路由：POST {baseUrl}/v1/video/generations
async function callToterVideoAPI(prompt, referenceImage, options = {}) {
  const cfg = state.toterConfig;
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/v1/video/generations`;
  const duration = options.duration || 5;
  const ratio = options.aspectRatio || '9:16';

  const body = {
    model: cfg.videoModel,
    prompt: prompt + ', cinematic, high quality, masterpiece',
    duration: duration,
    aspect_ratio: ratio,
  };
  if (referenceImage) {
    body.image = referenceImage; // 图生视频
  }

  // 步骤1：提交任务（走本地代理，避免浏览器 CORS 拦截）
  const createRes = await proxyFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Toter视频API失败 (${createRes.status}): ${errText.substring(0, 400)}`);
  }

  const taskData = await createRes.json();

  // 成功响应可能是同步返回视频URL，或异步返回任务ID需轮询
  // 同步：直接含 video_url / url
  const syncUrl = taskData.video_url || taskData.url
    || (taskData.data && (taskData.data.video_url || taskData.data.url));
  if (syncUrl) {
    return {
      type: 'mp4_video',
      url: syncUrl,
      thumb: referenceImage || null,
      prompt: prompt,
      duration: duration + 's',
      provider: 'toter',
      model: cfg.videoModel,
    };
  }

  // 异步：含 id 则轮询
  const taskId = taskData.id || (taskData.data && taskData.data.id);
  if (taskId) {
    const taskUrl = `${cfg.baseUrl.replace(/\/$/, '')}/v1/video/generations/${taskId}`;
    let videoUrl = null;
    let attempts = 0;
    const maxAttempts = 60; // 最多轮询60次 (约5分钟)
    while (attempts < maxAttempts) {
      await sleep(5000);
      const pollRes = await proxyFetch(taskUrl, { headers: { 'Authorization': `Bearer ${cfg.apiKey}` } });
      if (!pollRes.ok) { attempts++; continue; }
      const pollData = await pollRes.json();
      const status = pollData.status || (pollData.data && pollData.data.status);
      if (status === 'succeeded' || status === 'success') {
        videoUrl = pollData.video_url || pollData.url
          || (pollData.data && (pollData.data.video_url || pollData.data.url));
        if (videoUrl) break;
      } else if (status === 'failed' || status === 'cancelled') {
        throw new Error('Toter视频任务失败: ' + (pollData.error?.message || JSON.stringify(pollData)));
      }
      attempts++;
    }
    if (!videoUrl) throw new Error('Toter视频生成超时，请稍后再试');
    return {
      type: 'mp4_video',
      url: videoUrl,
      thumb: referenceImage || null,
      prompt: prompt,
      duration: duration + 's',
      provider: 'toter',
      model: cfg.videoModel,
    };
  }

  // 既无同步URL也无任务ID：原样抛出以便排查
  throw new Error('Toter视频API返回格式未知: ' + JSON.stringify(taskData).substring(0, 400));
}

// 回退方案：使用图片关键帧模拟视频
async function fallbackVideoGen(prompt, referenceImage, options = {}) {
  const seed = options.seed >= 0 ? options.seed : Math.floor(Math.random() * 1000000);
  const videoPrompt = (prompt || '').substring(0, 250).replace(/#/g, '');
  const fullPrompt = videoPrompt + ', cinematic frame, key shot, dramatic lighting';
  const [thumbW, thumbH] = ratioToSize(options.aspectRatio);
  const thumbUrl = referenceImage || `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${thumbW}&height=${thumbH}&seed=${seed}&nologo=true`;

  // 预加载缩略图
  await new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const timeout = setTimeout(() => { if (!done) { done = true; resolve(); } }, 15000);
    img.onload = () => { if (!done) { done = true; clearTimeout(timeout); resolve(); } };
    img.onerror = () => { if (!done) { done = true; clearTimeout(timeout); resolve(); } };
    img.src = thumbUrl;
  });

  return {
    type: 'animated_thumbnail',
    thumb: thumbUrl,
    url: thumbUrl,
    prompt: videoPrompt,
    duration: (options.duration || 5) + 's',
    provider: 'fallback',
    model: 'keyframes',
  };
}

function generatePlaceholderImage(prompt, ratio) {
  const seed = Math.floor(Math.random() * 1000000);
  const cleanPrompt = (prompt || 'anime character').substring(0, 300).replace(/#/g, '');
  const encodedPrompt = encodeURIComponent(cleanPrompt);
  const [imgW, imgH] = ratioToSize(ratio);
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${imgW}&height=${imgH}&seed=${seed}&nologo=true`;
}

// ==================== 工作流执行 ====================
async function autoRunWorkflow() {
  // 按拓扑排序执行所有节点
  const sorted = topologicalSort();
  if (sorted.length === 0) {
    showToast('画布上没有节点', 'error');
    return;
  }

  showToast('开始执行工作流...', 'info');
  state.generating = true;

  for (const nodeId of sorted) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) continue;

    // 检查是否所有输入都准备好了
    const inputs = NODE_TYPES[node.type].inputs;
    const allReady = inputs.every(input => {
      const conn = state.connections.find(c => c.toNode === nodeId && c.toPort === input);
      if (!conn) return true; // 可选输入
      const sourceNode = state.nodes.find(n => n.id === conn.fromNode);
      return sourceNode && sourceNode.status === 'done';
    });

    if (allReady) {
      await executeNode(nodeId);
    }
  }

  state.generating = false;
  showToast('工作流执行完成！🎬', 'success');
}

function topologicalSort() {
  const visited = new Set();
  const result = [];

  function visit(nodeId) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    // 先访问依赖
    state.connections.filter(c => c.toNode === nodeId).forEach(c => visit(c.fromNode));
    result.push(nodeId);
  }

  state.nodes.forEach(n => visit(n.id));
  return result;
}

function updateDownstreamNodes(nodeId) {
  // 找到所有下游节点并更新它们的body（可能需要显示新的输入状态）
  state.connections.filter(c => c.fromNode === nodeId).forEach(conn => {
    const node = state.nodes.find(n => n.id === conn.toNode);
    if (node) refreshNodeBody(node);
  });
}

async function generateFinalVideo() {
  // 找到导出节点
  const exportNode = state.nodes.find(n => n.type === 'export');
  if (!exportNode) {
    showToast('未找到导出合成器节点，正在自动添加...', 'info');
    const node = addNode('export', 800, 400);
    showToast('请连接视频到导出节点后再次点击', 'info');
    return;
  }

  if (exportNode.status !== 'done') {
    await executeNode(exportNode.id);
  }

  if (exportNode.output) {
    showFinalResult(exportNode.output);
  }
}

function showFinalResult(result) {
  const modal = document.getElementById('helpModal');
  modal.querySelector('.modal-header h2').textContent = '🎬 成片已生成';
  modal.querySelector('.modal-body').innerHTML = `
    <div style="text-align:center;padding:20px;">
      <div style="font-size:64px;margin-bottom:16px;">🎬</div>
      <h3 style="font-size:20px;margin-bottom:8px;">漫剧成片生成完成！</h3>
      <div style="color:var(--text-secondary);margin-bottom:20px;">
        ${result.videoCount} 个视频片段 · ${result.hasAudio ? '含背景音乐' : '无背景音乐'} · ${result.resolution} · ${result.format}
      </div>
      <div style="background:var(--bg-input);border-radius:10px;padding:20px;margin-bottom:16px;">
        <div style="font-size:48px;margin-bottom:12px;">✅</div>
        <div style="color:var(--text-primary);font-size:14px;margin-bottom:8px;">成片已合成完毕</div>
        <div style="color:var(--text-muted);font-size:12px;">
          📹 视频片段：${result.videoCount} 个<br>
          🎵 背景音乐：${result.hasAudio ? '已添加' : '未添加'}<br>
          📐 分辨率：${result.resolution}<br>
          📦 格式：${result.format}
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button class="topbar-btn primary" onclick="showToast('开始下载成片...', 'success')">📥 下载成片</button>
        <button class="topbar-btn" onclick="showToast('已分享到社区！', 'success')">📤 分享</button>
      </div>
    </div>
  `;
  modal.classList.add('show');
}

// ==================== 辅助函数 ====================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 获取当前使用的代理基地址
function getProxyBase() {
  // 用户手动配置了代理地址，优先使用
  if (state.proxyBaseUrl && state.proxyBaseUrl.trim()) {
    return state.proxyBaseUrl.trim().replace(/\/$/, '');
  }
  // 正常 http/https 部署：走同源代理
  if (window.location.protocol !== 'file:') {
    return window.location.origin;
  }
  // 直接双击打开本地 HTML（file://）时浏览器没有 origin，必须回退到本地 Node 服务
  return 'http://127.0.0.1:3000';
}

// 通用本地代理 URL 生成器（解决浏览器直接访问第三方 HTTPS API 的 CORS 问题）
function proxyUrl(targetUrl) {
  try {
    const u = new URL(targetUrl);
    const base = `${u.protocol}//${u.host}`;
    const path = u.pathname + u.search;
    const proxyBase = getProxyBase();
    return `${proxyBase}/proxy?target=${encodeURIComponent(base)}&path=${encodeURIComponent(path)}`;
  } catch (e) {
    return targetUrl;
  }
}
async function proxyFetch(url, init = {}) {
  const proxy = proxyUrl(url);
  if (proxy === url) return fetch(url, init);
  try {
    return await fetch(proxy, init);
  } catch (e) {
    // 代理不可达（部署的 Node 服务未运行 / 端口不对 / 被防火墙拦截 / 本地 file:// 未启动 server.js）
    const proxyBase = getProxyBase();
    const isFile = window.location.protocol === 'file:';
    const hint = isFile
      ? `你当前是直接打开本地文件（file://），代理服务应运行在 ${proxyBase}。请先在项目目录执行「node server.js」启动服务，或到 API 设置中心修改「代理服务地址」。`
      : `代理服务不可达（${proxyBase}/proxy）。请确认已部署并运行 Node 服务（server.js），或修改 API 设置中心里的「代理服务地址」。`;
    const err = new Error(hint);
    err.proxyDown = true;
    throw err;
  }
}
// 探测代理是否存活（用于设置中心状态徽章）
// 注意：静态托管会把未知路径兜底返回 index.html(200)，必须解析 JSON 内容确认真的是 Node 后端在跑
async function checkProxyHealth() {
  try {
    const proxyBase = getProxyBase();
    const r = await fetch(proxyBase + '/api/ping', { method: 'GET' });
    if (!r.ok) return false;
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const j = await r.json();
      return j && j.ok === true;
    }
    return false; // 返回的是 HTML 兜底页，说明没有真正运行 Node 代理后端
  } catch (e) {
    return false;
  }
}
// 根据 HTTP 状态码给出可操作的失败原因
function apiStatusHint(status, bodyText) {
  const b = (bodyText || '').substring(0, 180);
  switch (status) {
    case 401: return '🔑 密钥被服务端拒绝（401）。通常是：Key 无效 / 格式错误 / 不是该平台的「推理(ARK) Key」。请到对应控制台重新生成并复制完整 Key。';
    case 403: return '🚫 无权限（403）。该 Key 没有访问此接口的权限，或账号未开通对应服务。';
    case 404: return '🔍 接口路径不存在（404）。请检查「接口地址」是否多了/少了 /v1 等前缀，或模型名拼写错误。';
    case 400:
    case 422: return `⚠️ 请求参数错误（${status}）：${b}`;
    default:
      if (status >= 500) return `🔧 服务端错误（${status}）。这是对方服务器的问题，请稍后重试或联系服务商。`;
      return `⚠️ 连接返回 ${status}：${b}`;
  }
}

function renderAll() {
  // 渲染所有节点
  state.nodes.forEach(node => {
    const existing = document.getElementById('node-' + node.id);
    if (existing) existing.remove();
    renderNode(node);
  });
  updateConnections();
}

function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      if (state.selectedNode) {
        deleteNode(state.selectedNode);
      } else if (state.selectedConn) {
        deleteConnection(state.selectedConn);
      }
    }
    if (e.key === 'Escape') {
      closeProps();
      cancelConnecting();
      hideContextMenu();
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
      document.getElementById('previewModal').classList.remove('show');
      document.getElementById('galleryOverlay').classList.remove('show');
    }
  });

  // 点击空白处关闭右键菜单
  document.addEventListener('click', () => hideContextMenu());
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function showHelp() {
  document.getElementById('helpModal').classList.add('show');
}

function exportProject() {
  const data = {
    name: document.getElementById('projectName').value,
    nodes: state.nodes,
    connections: state.connections,
    canvas: state.canvas,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (data.name || '漫剧项目') + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('项目已导出', 'success');
}

function toggleBottomBar() {
  document.getElementById('bottomBar').classList.toggle('show');
}

function openImagePreview(url) {
  document.getElementById('previewModalContent').innerHTML = `<img src="${url}" alt="预览">`;
  document.getElementById('previewModal').classList.add('show');
}

function closePreview(e) {
  if (e.target === e.currentTarget) closePreviewModal();
}

function closePreviewModal() {
  document.getElementById('previewModal').classList.remove('show');
}

// ==================== 豆包设置管理 ====================
function openApiCenter() {
  // 检测本地代理状态（所有外部 API 都经此代理，代理挂了则全部连不上）
  const badge = document.getElementById('proxy-status-badge');
  const proxyBase = getProxyBase();
  const isFile = window.location.protocol === 'file:';
  if (badge) {
    badge.className = 'proxy-badge proxy-badge-checking';
    badge.textContent = '🟡 检测本地代理…';
    checkProxyHealth().then(ok => {
      if (ok) {
        badge.className = 'proxy-badge proxy-badge-ok';
        badge.textContent = isFile ? `🟢 代理已连接（${proxyBase}）` : '🟢 云端代理已连接（同源）';
      } else {
        badge.className = 'proxy-badge proxy-badge-down';
        badge.textContent = isFile ? `🔴 代理未连接！请确认 ${proxyBase} 已启动` : '🔴 代理未连接！请确认 Node 服务已部署运行';
      }
    }).catch(() => {
      badge.className = 'proxy-badge proxy-badge-down';
      badge.textContent = isFile ? `🔴 代理未连接！请确认 ${proxyBase} 已启动` : '🔴 代理未连接！请确认 Node 服务已部署运行';
    });
  }

  // 回填代理服务地址
  const proxyInput = document.getElementById('proxy-base-url');
  if (proxyInput) {
    proxyInput.value = state.proxyBaseUrl || (isFile ? 'http://127.0.0.1:3000' : '');
  }

  // 回填豆包配置
  document.getElementById('doubao-api-key').value = state.doubaoConfig.apiKey || '';
  document.getElementById('doubao-endpoint').value = state.doubaoConfig.endpoint || 'https://ark.cn-beijing.volces.com/api/v3';
  document.getElementById('doubao-enabled').value = state.doubaoConfig.enabled ? 'true' : 'false';
  const dbStatus = document.getElementById('doubao-status');
  if (state.doubaoConfig.apiKey && state.doubaoConfig.enabled) {
    dbStatus.style.display = 'block';
    dbStatus.style.background = 'rgba(34, 197, 94, 0.15)';
    dbStatus.style.color = '#4ade80';
    dbStatus.innerHTML = '✅ 豆包API已启用';
  } else {
    dbStatus.style.display = 'none';
  }

  // 回填 Toter 配置
  document.getElementById('toter-api-key').value = state.toterConfig.apiKey || '';
  document.getElementById('toter-base-url').value = state.toterConfig.baseUrl || 'https://speed.toter.me';
  document.getElementById('toter-video-model').value = state.toterConfig.videoModel || '入梦 Flash';
  document.getElementById('toter-enabled').value = state.toterConfig.enabled ? 'true' : 'false';

  // 回填自定义 API 配置
  if (typeof fillCustomApiFields === 'function') fillCustomApiFields();

  // 回填 ComfyUI 配置（由 comfy-bridge.js 提供 fillComfyFields）
  if (typeof window.fillComfyFields === 'function') window.fillComfyFields();

  // 显示统一设置中心
  document.getElementById('apiCenterModal').classList.add('show');
}

function closeApiCenter() {
  document.getElementById('apiCenterModal').classList.remove('show');
}

function openDoubaoSettings() { openApiCenter(); }
function closeDoubaoSettings() { closeApiCenter(); }

function saveDoubaoSettings() {
  const apiKey = document.getElementById('doubao-api-key').value.trim();
  const endpoint = document.getElementById('doubao-endpoint').value.trim();
  const enabled = document.getElementById('doubao-enabled').value === 'true';

  state.doubaoConfig.apiKey = apiKey;
  state.doubaoConfig.endpoint = endpoint || 'https://ark.cn-beijing.volces.com/api/v3';
  state.doubaoConfig.enabled = enabled && apiKey.length > 0;

  // 保存到 localStorage
  try {
    localStorage.setItem('libtv_doubao_config', JSON.stringify(state.doubaoConfig));
  } catch (e) {}

  closeDoubaoSettings();
  showToast(state.doubaoConfig.enabled ? '✅ 豆包API已保存并启用' : '✅ 配置已保存（未启用）', 'success');

  // 更新顶栏按钮状态
  updateDoubaoButton();
}

function clearDoubaoSettings() {
  if (!confirm('确定清空豆包API配置吗？')) return;
  state.doubaoConfig.apiKey = '';
  state.doubaoConfig.enabled = false;
  try { localStorage.removeItem('libtv_doubao_config'); } catch (e) {}
  document.getElementById('doubao-api-key').value = '';
  document.getElementById('doubao-enabled').value = 'false';
  updateDoubaoButton();
  showToast('豆包配置已清空', 'info');
}

async function testDoubaoConnection() {
  const apiKey = document.getElementById('doubao-api-key').value.trim();
  const endpoint = document.getElementById('doubao-endpoint').value.trim();

  if (!apiKey) {
    showToast('请先填写 API Key', 'error');
    return;
  }

  const statusEl = document.getElementById('doubao-status');
  statusEl.style.display = 'block';
  statusEl.style.background = 'rgba(77, 141, 255, 0.15)';
  statusEl.style.color = '#4d8dff';
  statusEl.innerHTML = '🔄 正在测试连接...';

  try {
    // 简单的连接测试：查询模型列表（走本地代理，避免浏览器 CORS 拦截）
    const res = await proxyFetch(`${endpoint}/models`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (res.ok) {
      const data = await res.json();
      statusEl.style.background = 'rgba(34, 197, 94, 0.15)';
      statusEl.style.color = '#4ade80';
      statusEl.innerHTML = `✅ 连接成功！发现 ${data.data?.length || 0} 个可用模型`;

      // 检查是否有豆包视频模型
      const videoModels = (data.data || []).filter(m => m.id?.includes('seedance') || m.id?.includes('doubao'));
      if (videoModels.length > 0) {
        statusEl.innerHTML += `<br>🎬 视频模型: ${videoModels.map(m => m.id).join(', ')}`;
      } else {
        statusEl.innerHTML += `<br>⚠️ 未发现豆包视频模型，请确认已开通视频生成服务`;
      }
    } else {
      const errText = await res.text();
      statusEl.style.background = 'rgba(220, 38, 38, 0.15)';
      statusEl.style.color = '#f87171';
      statusEl.innerHTML = `❌ ${apiStatusHint(res.status, errText)}`;
    }
  } catch (e) {
    statusEl.style.background = 'rgba(220, 38, 38, 0.15)';
    statusEl.style.color = '#f87171';
    statusEl.innerHTML = e.proxyDown ? `❌ ${e.message}` : `❌ 网络错误: ${e.message}`;
  }
}

function updateDoubaoButton() {
  const btn = document.querySelector('.doubao-btn');
  if (!btn) return;
  if (state.doubaoConfig.enabled && state.doubaoConfig.apiKey) {
    btn.style.background = 'rgba(255, 107, 53, 0.2)';
    btn.style.borderColor = '#ff6b35';
    btn.innerHTML = '🔥 豆包✅';
  } else {
    btn.style.background = '';
    btn.style.borderColor = '#ff6b35';
    btn.innerHTML = '🔥 豆包设置';
  }
}

function loadDoubaoConfig() {
  try {
    const saved = localStorage.getItem('libtv_doubao_config');
    if (saved) {
      const config = JSON.parse(saved);
      // 仅在已保存值非空/显式时覆盖默认值（默认值含预置 Key，避免被旧空配置清空）
      if (config.apiKey) state.doubaoConfig.apiKey = config.apiKey;
      if (config.endpoint) state.doubaoConfig.endpoint = config.endpoint;
      if (typeof config.enabled === 'boolean') state.doubaoConfig.enabled = config.enabled;
    }
  } catch (e) {}
}

function loadToterConfig() {
  try {
    const saved = localStorage.getItem('libtv_toter_config');
    if (saved) {
      const config = JSON.parse(saved);
      if (config.apiKey) state.toterConfig.apiKey = config.apiKey;
      if (config.baseUrl) state.toterConfig.baseUrl = config.baseUrl;
      if (config.videoModel) state.toterConfig.videoModel = config.videoModel;
      if (typeof config.enabled === 'boolean') state.toterConfig.enabled = config.enabled;
    }
  } catch (e) {}
}

// Toter 网关设置弹窗
function openToterSettings() { openApiCenter(); }
function closeToterSettings() { closeApiCenter(); }

function saveToterSettings() {
  state.toterConfig.apiKey = document.getElementById('toter-api-key').value.trim();
  state.toterConfig.baseUrl = document.getElementById('toter-base-url').value.trim() || 'https://speed.toter.me';
  state.toterConfig.videoModel = document.getElementById('toter-video-model').value.trim() || '入梦 Flash';
  state.toterConfig.enabled = document.getElementById('toter-enabled').value === 'true' && state.toterConfig.apiKey.length > 0;
  try { localStorage.setItem('libtv_toter_config', JSON.stringify(state.toterConfig)); } catch (e) {}
  closeToterSettings();
  updateToterButton();
  showToast(state.toterConfig.enabled ? '✅ Toter 网关已保存并启用' : '✅ 配置已保存（未启用）', 'success');
}
function clearToterSettings() {
  if (!confirm('确定清空 Toter 网关配置吗？')) return;
  state.toterConfig.apiKey = '';
  state.toterConfig.enabled = false;
  try { localStorage.removeItem('libtv_toter_config'); } catch (e) {}
  document.getElementById('toter-api-key').value = '';
  document.getElementById('toter-enabled').value = 'false';
  updateToterButton();
  showToast('Toter 配置已清空', 'info');
}
async function testToterConnection() {
  const apiKey = document.getElementById('toter-api-key').value.trim();
  const baseUrl = document.getElementById('toter-base-url').value.trim() || 'https://speed.toter.me';
  const statusEl = document.getElementById('toter-status');
  statusEl.style.display = 'block';
  statusEl.style.background = 'rgba(77, 141, 255, 0.15)';
  statusEl.style.color = '#4d8dff';
  statusEl.innerHTML = '🔄 正在测试连接...';
  try {
    const res = await proxyFetch(`${baseUrl.replace(/\/$/, '')}/v1/models`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    if (res.ok) {
      const data = await res.json();
      const models = (data.data || []).map(m => m.id);
      const videoModels = models.filter(m => m.includes('梦') || m.toLowerCase().includes('video') || m.toLowerCase().includes('kling') || m.toLowerCase().includes('sora'));
      statusEl.style.background = 'rgba(34, 197, 94, 0.15)';
      statusEl.style.color = '#4ade80';
      statusEl.innerHTML = `✅ 连接成功！共 ${models.length} 个可用模型` + (videoModels.length ? `<br>🎬 视频模型: ${videoModels.join(', ')}` : '');
    } else {
      const t = await res.text();
      statusEl.style.background = 'rgba(220, 38, 38, 0.15)';
      statusEl.style.color = '#f87171';
      statusEl.innerHTML = `❌ ${apiStatusHint(res.status, t)}`;
    }
  } catch (e) {
    statusEl.style.background = 'rgba(220, 38, 38, 0.15)';
    statusEl.style.color = '#f87171';
    statusEl.innerHTML = e.proxyDown ? `❌ ${e.message}` : `❌ 连接异常: ${e.message}`;
  }
}
function updateToterButton() {
  const btn = document.getElementById('toter-btn');
  if (!btn) return;
  if (state.toterConfig.enabled && state.toterConfig.apiKey) {
    btn.innerHTML = '🌟 Toter✅';
    btn.style.opacity = '1';
  } else {
    btn.innerHTML = '🌟 Toter';
    btn.style.opacity = '0.6';
  }
}

// ==================== 自定义 API 管理 ====================
function loadProxyBaseUrl() {
  try {
    const saved = localStorage.getItem('libtv_proxy_base_url');
    if (saved) state.proxyBaseUrl = saved;
  } catch (e) {}
}
function saveProxyBaseUrl() {
  const val = (document.getElementById('proxy-base-url').value || '').trim().replace(/\/$/, '');
  state.proxyBaseUrl = val;
  try { localStorage.setItem('libtv_proxy_base_url', val); } catch (e) {}
  // 立即重新检测一次，给用户实时反馈
  const badge = document.getElementById('proxy-status-badge');
  const proxyBase = getProxyBase();
  const isFile = window.location.protocol === 'file:';
  if (badge) {
    badge.className = 'proxy-badge proxy-badge-checking';
    badge.textContent = '🟡 检测中…';
    checkProxyHealth().then(ok => {
      if (ok) {
        badge.className = 'proxy-badge proxy-badge-ok';
        badge.textContent = isFile ? `🟢 代理已连接（${proxyBase}）` : '🟢 云端代理已连接（同源）';
        showToast('✅ 代理地址已保存并连接成功', 'success');
      } else {
        badge.className = 'proxy-badge proxy-badge-down';
        badge.textContent = isFile ? `🔴 代理未连接！请确认 ${proxyBase} 已启动` : '🔴 代理未连接！请确认 Node 服务已部署运行';
        showToast('⚠️ 代理地址已保存，但当前无法连通', 'error');
      }
    });
  } else {
    showToast('✅ 代理地址已保存', 'success');
  }
}
function clearProxyBaseUrl() {
  state.proxyBaseUrl = '';
  try { localStorage.removeItem('libtv_proxy_base_url'); } catch (e) {}
  const el = document.getElementById('proxy-base-url');
  if (el) el.value = window.location.protocol === 'file:' ? 'http://127.0.0.1:3000' : '';
  showToast('代理地址已恢复自动推断', 'info');
}

function loadCustomApiConfig() {
  try {
    const saved = localStorage.getItem('libtv_custom_api_config');
    if (saved) {
      const c = JSON.parse(saved);
      if (c.name !== undefined) state.customApiConfig.name = c.name;
      if (c.baseUrl) state.customApiConfig.baseUrl = c.baseUrl;
      if (c.apiKey) state.customApiConfig.apiKey = c.apiKey;
      if (c.model) state.customApiConfig.model = c.model;
      if (c.type) state.customApiConfig.type = c.type;
      if (typeof c.enabled === 'boolean') state.customApiConfig.enabled = c.enabled;
    }
  } catch (e) {}
}

function fillCustomApiFields() {
  const c = state.customApiConfig;
  const el = id => document.getElementById(id);
  if (el('custom-name')) el('custom-name').value = c.name || '';
  if (el('custom-base-url')) el('custom-base-url').value = c.baseUrl || '';
  if (el('custom-api-key')) el('custom-api-key').value = c.apiKey || '';
  if (el('custom-model')) el('custom-model').value = c.model || '';
  if (el('custom-type')) el('custom-type').value = c.type || 'video';
  if (el('custom-enabled')) el('custom-enabled').value = c.enabled ? 'true' : 'false';
  const s = el('custom-status');
  if (s) s.style.display = 'none';
}

function saveCustomApiSettings() {
  const el = id => document.getElementById(id);
  const name = (el('custom-name').value || '').trim();
  const baseUrl = (el('custom-base-url').value || '').trim().replace(/\/+$/, '');
  const apiKey = (el('custom-api-key').value || '').trim();
  const model = (el('custom-model').value || '').trim();
  const type = el('custom-type').value;
  const enabled = el('custom-enabled').value === 'true';

  if (enabled && (!baseUrl || !apiKey || !model)) {
    showToast('⚠️ 启用自定义 API 需填写：接口地址、Key、模型名', 'error');
    return;
  }

  state.customApiConfig = { name, baseUrl, apiKey, model, type, enabled: enabled && !!baseUrl };
  try { localStorage.setItem('libtv_custom_api_config', JSON.stringify(state.customApiConfig)); } catch (e) {}
  showToast(state.customApiConfig.enabled ? ('✅ 自定义 API「' + (name || '未命名') + '」已保存并启用') : '✅ 自定义 API 已保存（未启用）', 'success');
}

function clearCustomApiSettings() {
  if (!confirm('确定清空自定义 API 配置吗？')) return;
  state.customApiConfig = { name: '', baseUrl: '', apiKey: '', model: '', type: 'video', enabled: false };
  try { localStorage.removeItem('libtv_custom_api_config'); } catch (e) {}
  fillCustomApiFields();
  showToast('自定义 API 配置已清空', 'info');
}

async function testCustomApiConnection() {
  const el = id => document.getElementById(id);
  const baseUrl = (el('custom-base-url').value || '').trim().replace(/\/+$/, '');
  const apiKey = (el('custom-api-key').value || '').trim();
  const statusEl = el('custom-status');
  statusEl.style.display = 'block';
  if (!baseUrl) {
    statusEl.style.background = 'rgba(220, 38, 38, 0.15)';
    statusEl.style.color = '#f87171';
    statusEl.innerHTML = '❌ 请先填写接口地址（如 https://xxx/v1）';
    return;
  }
  statusEl.style.background = 'rgba(77, 141, 255, 0.15)';
  statusEl.style.color = '#4d8dff';
  statusEl.innerHTML = '🔄 正在测试连接...';
  try {
    const res = await proxyFetch(`${baseUrl}/models`, { headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {} });
    if (res.ok) {
      const data = await res.json();
      const models = (data.data || []).map(m => m.id);
      statusEl.style.background = 'rgba(34, 197, 94, 0.15)';
      statusEl.style.color = '#4ade80';
      statusEl.innerHTML = `✅ 连接成功！共 ${models.length} 个模型` +
        (models.length ? `<br>📋 ${models.slice(0, 12).join(', ')}${models.length > 12 ? ' …' : ''}` : '') +
        `<br>请在「模型名」填入你要用的模型标识`;
    } else {
      const t = await res.text();
      statusEl.style.background = 'rgba(220, 38, 38, 0.15)';
      statusEl.style.color = '#f87171';
      statusEl.innerHTML = `❌ ${apiStatusHint(res.status, t)}`;
    }
  } catch (e) {
    statusEl.style.background = 'rgba(220, 38, 38, 0.15)';
    statusEl.style.color = '#f87171';
    statusEl.innerHTML = e.proxyDown ? `❌ ${e.message}` : `❌ 连接异常: ${e.message}`;
  }
}

// 自定义 API —— 图片生成（OpenAI 兼容 /images/generations）
async function callCustomImageAPI(prompt, referenceImage, ratio) {
  const c = state.customApiConfig;
  const [w, h] = ratioToSize(ratio);
  const body = {
    model: c.model,
    prompt: prompt.substring(0, 1000),
    n: 1,
    size: `${w}x${h}`,
  };
  // 若参考图为可访问 URL，则按 OpenAI i2i 规范附带
  if (referenceImage && /^https?:\/\//i.test(referenceImage)) {
    body.image = referenceImage;
  }
  const res = await proxyFetch(`${c.baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${c.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('自定义API图片生成失败 (' + res.status + '): ' + t.substring(0, 200));
  }
  const data = await res.json();
  const item = (data.data && data.data[0]) || null;
  let url = item && (item.url || (item.b64_json ? 'data:image/png;base64,' + item.b64_json : null));
  if (!url) throw new Error('自定义API未返回图片地址，返回内容：' + JSON.stringify(data).substring(0, 200));
  return { type: 'image', url, prompt, provider: 'custom', model: c.model };
}

// 自定义 API —— 视频生成（OpenAI 兼容 /video/generations，兼容同步返回与异步任务）
async function callCustomVideoAPI(prompt, referenceImage, options = {}) {
  const c = state.customApiConfig;
  const body = {
    model: c.model,
    prompt: prompt.substring(0, 1000),
    duration: parseInt(options.duration) || 5,
  };
  if (referenceImage && /^https?:\/\//i.test(referenceImage)) body.image = referenceImage;

  const res = await proxyFetch(`${c.baseUrl}/video/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${c.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('自定义API视频生成失败 (' + res.status + '): ' + t.substring(0, 200));
  }
  const data = await res.json();

  // 情况 A：直接返回视频 URL
  const directUrl = data.url || data.video_url || (data.data && data.data[0] && (data.data[0].url || data.data[0].video_url));
  if (directUrl) {
    return { type: 'mp4_video', url: directUrl, thumb: referenceImage || null, prompt, duration: (options.duration || 5) + 's', provider: 'custom', model: c.model };
  }

  // 情况 B：返回异步任务 ID，轮询结果
  const taskId = data.task_id || data.id || data.taskId;
  if (taskId) {
    const pollPaths = [`/video/generations/${taskId}`, `/tasks/${taskId}`, `/videos/${taskId}`];
    for (let i = 0; i < 60; i++) { // 最多 ~5 分钟
      await sleep(5000);
      let got = null;
      for (const p of pollPaths) {
        try {
          const pr = await proxyFetch(`${c.baseUrl}${p}`, { headers: { 'Authorization': `Bearer ${c.apiKey}` } });
          if (pr.ok) { got = await pr.json(); break; }
        } catch (e) { /* 重试其他路径 */ }
      }
      if (!got) continue;
      const u = got.url || got.video_url || (got.data && got.data[0] && (got.data[0].url || got.data[0].video_url));
      if (u) return { type: 'mp4_video', url: u, thumb: referenceImage || null, prompt, duration: (options.duration || 5) + 's', provider: 'custom', model: c.model };
      if (got.status === 'failed' || got.status_str === 'error') throw new Error('自定义API视频任务失败：' + JSON.stringify(got).substring(0, 200));
    }
    throw new Error('自定义API视频生成超时（轮询 5 分钟无结果）');
  }

  // 情况 C：无法识别的返回结构，抛出原始内容便于排查
  throw new Error('自定义API返回结构无法解析：' + JSON.stringify(data).substring(0, 300));
}

// 在页面加载时恢复配置
setTimeout(() => {
  loadProxyBaseUrl();
  loadDoubaoConfig();
  loadToterConfig();
  loadCustomApiConfig();
  updateDoubaoButton();
  updateToterButton();
}, 100);

// ==================== 默认工作流 ====================
function createDefaultWorkflow() {
  // 创建标准工作流：脚本 → 角色 → 分镜图 → 视频 → 导出
  const scriptNode = addNode('script', 60, 80);
  const charNode = addNode('character', 60, 380);
  const imageNode = addNode('imageGen', 420, 180);
  const videoNode = addNode('videoGen', 780, 180);
  const musicNode = addNode('music', 420, 500);
  const exportNode = addNode('export', 780, 400);

  // 添加连线
  state.connIdCounter++;
  state.connections.push({ id: 'c' + state.connIdCounter, fromNode: scriptNode.id, fromPort: 'script', toNode: imageNode.id, toPort: 'script' });
  state.connIdCounter++;
  state.connections.push({ id: 'c' + state.connIdCounter, fromNode: charNode.id, fromPort: 'character', toNode: imageNode.id, toPort: 'character' });
  state.connIdCounter++;
  state.connections.push({ id: 'c' + state.connIdCounter, fromNode: imageNode.id, fromPort: 'images', toNode: videoNode.id, toPort: 'images' });
  state.connIdCounter++;
  state.connections.push({ id: 'c' + state.connIdCounter, fromNode: videoNode.id, fromPort: 'videos', toNode: exportNode.id, toPort: 'videos' });
  state.connIdCounter++;
  state.connections.push({ id: 'c' + state.connIdCounter, fromNode: musicNode.id, fromPort: 'audio', toNode: exportNode.id, toPort: 'audio' });
}

// ==================== 启动 ====================
document.addEventListener('DOMContentLoaded', init);

// ==================== 作品库 ====================
function addToGallery(node) {
  const nodeType = NODE_TYPES[node.type];
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  if (node.type === 'script' && node.output && node.output.scenes) {
    state.gallery.unshift({
      id: 'g' + Date.now() + Math.random().toString(36).substr(2, 4),
      type: 'script',
      title: node.output.title || nodeType.name,
      source: nodeType.name,
      time: timestamp,
      data: node.output,
      thumb: null,
    });
  } else if (node.type === 'imageGen' && node.outputs.images) {
    node.outputs.images.forEach((url, i) => {
      state.gallery.unshift({
        id: 'g' + Date.now() + i + Math.random().toString(36).substr(2, 4),
        type: 'image',
        title: `${nodeType.name} #${i + 1}`,
        source: nodeType.name,
        time: timestamp,
        thumb: url,
        url: url,
      });
    });
  } else if ((node.type === 'character' || node.type === 'textToImage' || node.type === 'imageToImage') && node.output) {
    state.gallery.unshift({
      id: 'g' + Date.now() + Math.random().toString(36).substr(2, 4),
      type: 'image',
      title: nodeType.name,
      source: nodeType.name,
      time: timestamp,
      thumb: node.output,
      url: node.output,
    });
  } else if (node.type === 'videoGen' && node.outputs.videos) {
    node.outputs.videos.forEach((v, i) => {
      if (v) {
        const url = typeof v === 'string' ? v : (v.url || v.thumb);
        const prompt = typeof v === 'object' ? (v.prompt || '') : '';
        state.gallery.unshift({
          id: 'g' + Date.now() + i + Math.random().toString(36).substr(2, 4),
          type: 'video',
          title: `${nodeType.name} #${i + 1}`,
          source: nodeType.name,
          time: timestamp,
          thumb: url,
          url: url,
          prompt: prompt,
        });
      }
    });
  } else if (node.type === 'textToVideo' && node.output) {
    const url = typeof node.output === 'string' ? node.output : (node.output.url || node.output.thumb);
    const prompt = typeof node.output === 'object' ? (node.output.prompt || node.data.prompt) : node.data.prompt;
    state.gallery.unshift({
      id: 'g' + Date.now() + Math.random().toString(36).substr(2, 4),
      type: 'video',
      title: nodeType.name,
      source: nodeType.name,
      time: timestamp,
      thumb: url,
      url: url,
      prompt: prompt,
    });
  } else if (node.type === 'music' && node.output) {
    state.gallery.unshift({
      id: 'g' + Date.now() + Math.random().toString(36).substr(2, 4),
      type: 'script',
      title: nodeType.name,
      source: nodeType.name,
      time: timestamp,
      data: { title: node.output, scenes: [] },
      thumb: null,
    });
  } else if (node.type === 'export' && node.output) {
    state.gallery.unshift({
      id: 'g' + Date.now() + Math.random().toString(36).substr(2, 4),
      type: 'video',
      title: '🎬 最终成片',
      source: nodeType.name,
      time: timestamp,
      thumb: null,
      url: null,
      data: node.output,
    });
  }

  updateGalleryBadge();
}

function updateGalleryBadge() {
  const badge = document.getElementById('galleryBadge');
  if (state.gallery.length > 0) {
    badge.textContent = state.gallery.length;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function toggleGallery() {
  const overlay = document.getElementById('galleryOverlay');
  overlay.classList.toggle('show');
  if (overlay.classList.contains('show')) {
    renderGallery();
  }
}

function setGalleryFilter(filter) {
  state.galleryFilter = filter;
  document.querySelectorAll('.gallery-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === filter);
  });
  renderGallery();
}

function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  const countEl = document.getElementById('galleryCount');

  let items = state.gallery;
  if (state.galleryFilter !== 'all') {
    items = items.filter(item => item.type === state.galleryFilter);
  }

  countEl.textContent = `${items.length} 个作品`;

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="gallery-empty">
        <div class="gallery-empty-icon">🎬</div>
        <div class="gallery-empty-text">还没有生成任何作品</div>
        <div class="gallery-empty-hint">在画布上执行节点后，生成的图片/视频/脚本会自动出现在这里</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(item => {
    const typeLabel = { image: '📷 图片', video: '🎬 视频', script: '📜 脚本' }[item.type] || '📄';

    if (item.type === 'script') {
      const scriptText = item.data && item.data.scenes
        ? item.data.scenes.slice(0, 3).map((s, i) => `第${i+1}镜 [${s.shot}] ${s.description}`).join('\n')
        : (item.data && item.data.title) || '脚本内容';
      return `
        <div class="gallery-item" onclick="openGalleryScript('${item.id}')">
          <div class="gallery-item-thumb" style="aspect-ratio:auto;min-height:120px;">
            <span class="gallery-item-type ${item.type}">${typeLabel}</span>
            <div class="gallery-script-card">${scriptText}</div>
          </div>
          <div class="gallery-item-info">
            <div class="gallery-item-title">${item.title}</div>
            <div class="gallery-item-meta">${item.source} · ${item.time}</div>
          </div>
          <button class="gallery-item-del" onclick="event.stopPropagation();deleteGalleryItem('${item.id}')">✕</button>
        </div>
      `;
    }

    if (item.type === 'video') {
      return `
        <div class="gallery-item" onclick="openGalleryVideo('${item.id}')">
          <div class="gallery-item-thumb">
            <span class="gallery-item-type ${item.type}">${typeLabel}</span>
            ${item.url
              ? `<img src="${item.url}" alt="${item.title}" loading="lazy"><div class="video-play-overlay"><div class="play-icon">▶</div></div>`
              : `<div style="font-size:48px;">🎬</div>`
            }
          </div>
          <div class="gallery-item-info">
            <div class="gallery-item-title">${item.title}</div>
            <div class="gallery-item-meta">${item.source} · ${item.time}</div>
          </div>
          <button class="gallery-item-del" onclick="event.stopPropagation();deleteGalleryItem('${item.id}')">✕</button>
        </div>
      `;
    }

    // image
    return `
      <div class="gallery-item" onclick="openImagePreview('${item.url}')">
        <div class="gallery-item-thumb img-loading-wrap">
          <span class="gallery-item-type ${item.type}">${typeLabel}</span>
          <div class="img-spinner"></div>
          <img src="${item.url}" alt="${item.title}" loading="lazy"
            onload="this.parentElement.classList.add('loaded')"
            onerror="this.parentElement.classList.add('error');this.style.display='none'">
        </div>
        <div class="gallery-item-info">
          <div class="gallery-item-title">${item.title}</div>
          <div class="gallery-item-meta">${item.source} · ${item.time}</div>
        </div>
        <button class="gallery-item-del" onclick="event.stopPropagation();deleteGalleryItem('${item.id}')">✕</button>
      </div>
    `;
  }).join('');
}

function deleteGalleryItem(id) {
  const idx = state.gallery.findIndex(g => g.id === id);
  if (idx === -1) return;
  state.gallery.splice(idx, 1);
  renderGallery();
  updateGalleryBadge();
  showToast('作品已删除', 'info');
}

function clearGallery() {
  if (state.gallery.length === 0) {
    showToast('作品库已经是空的', 'info');
    return;
  }
  if (!confirm(`确定要清空 ${state.gallery.length} 个作品吗？`)) return;
  state.gallery = [];
  renderGallery();
  updateGalleryBadge();
  showToast('作品库已清空', 'success');
}

function openGalleryScript(id) {
  const item = state.gallery.find(g => g.id === id);
  if (!item || !item.data) return;

  const modal = document.getElementById('helpModal');
  modal.querySelector('.modal-header h2').textContent = `📜 ${item.title}`;
  modal.querySelector('.modal-body').innerHTML = `
    <div style="font-size:13px;line-height:2;color:var(--text-secondary);">
      ${item.data.scenes && item.data.scenes.length > 0
        ? item.data.scenes.map((s, i) => `
            <div style="padding:10px 14px;background:var(--bg-input);border-radius:8px;margin-bottom:8px;">
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
                <span style="color:var(--accent-blue);font-weight:700;">第${i+1}镜</span>
                <span style="color:var(--accent-purple);font-size:11px;">[${s.shot}]</span>
                <span style="color:var(--accent-orange);font-size:11px;">${s.emotion}</span>
                <span style="color:var(--text-muted);font-size:11px;margin-left:auto;">${s.duration}</span>
              </div>
              <div style="color:var(--text-primary);">${s.description}</div>
              ${s.dialogue ? `<div style="color:var(--accent-green);font-size:12px;margin-top:4px;">💬 ${s.dialogue}</div>` : ''}
              ${s.prompt ? `<div style="color:var(--text-muted);font-size:11px;margin-top:4px;">Prompt: ${s.prompt}</div>` : ''}
            </div>
          `).join('')
        : `<div style="text-align:center;padding:40px;color:var(--text-muted);">${item.data.title || '无脚本内容'}</div>`
      }
    </div>
  `;
  modal.classList.add('show');
}

function openGalleryVideo(id) {
  const item = state.gallery.find(g => g.id === id);
  if (!item) return;

  if (item.url) {
    document.getElementById('previewModalContent').innerHTML = `
      <div class="video-preview-large">
        <img src="${item.url}" alt="${item.title}" style="max-width:90%;max-height:70vh;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
        <div class="video-preview-info">
          <div class="video-preview-badge">🎬 AI生成视频</div>
          <div class="video-preview-prompt">${item.prompt || item.title}</div>
          <div class="video-preview-hint">📹 此为AI生成的关键帧预览</div>
        </div>
      </div>
    `;
    document.getElementById('previewModal').classList.add('show');
  } else if (item.data) {
    const modal = document.getElementById('helpModal');
    modal.querySelector('.modal-header h2').textContent = `🎬 ${item.title}`;
    modal.querySelector('.modal-body').innerHTML = `
      <div style="text-align:center;padding:20px;">
        <div style="font-size:64px;margin-bottom:16px;">🎬</div>
        <h3 style="font-size:18px;margin-bottom:12px;">成片信息</h3>
        <div style="color:var(--text-secondary);line-height:2;">
          <p>📹 视频片段：${item.data.videoCount || 0} 个</p>
          <p>🎵 背景音乐：${item.data.hasAudio ? '已添加' : '无'}</p>
          <p>📐 分辨率：${item.data.resolution || 'N/A'}</p>
          <p>📦 格式：${item.data.format || 'N/A'}</p>
          <p>✅ 状态：${item.data.status || '完成'}</p>
        </div>
      </div>
    `;
    modal.classList.add('show');
  }
}

// ==================== 右键菜单 ====================
// 渲染"添加节点"菜单列表
function renderAddNodeMenu() {
  const list = document.getElementById('addNodeMenuList');
  const categories = {};
  Object.entries(NODE_TYPES).forEach(([key, type]) => {
    if (!categories[type.category]) categories[type.category] = [];
    categories[type.category].push({ key, ...type });
  });
  list.innerHTML = Object.entries(categories).map(([cat, items]) => `
    <div class="add-node-menu-cat">${cat}</div>
    ${items.map(item => `
      <div class="context-menu-item add-node-menu-item" onclick="addNodeFromMenu('${item.key}')">
        <span class="add-node-menu-icon" style="background:${item.color}22;color:${item.color};">${item.icon}</span>
        <span class="add-node-menu-name">${item.name}</span>
        <span class="add-node-menu-desc">${item.desc}</span>
      </div>
    `).join('')}
  `).join('');
}

// 在画布空白处右键 → 显示添加节点菜单
function showAddNodeMenu(e) {
  e.preventDefault();
  e.stopPropagation();
  hideContextMenu();

  // 记录右键位置对应的画布坐标（新节点中心对齐此处）
  const pos = toCanvasCoords(e.clientX, e.clientY);
  state.addMenuPos = { x: Math.round(pos.x - 140), y: Math.round(pos.y - 40) };

  renderAddNodeMenu();
  const menu = document.getElementById('addNodeMenu');
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.classList.add('show');

  // 确保菜单不超出视口
  setTimeout(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
  }, 0);
}

// 从右键菜单添加节点（落点为右键位置，自动避开重叠）
function addNodeFromMenu(type) {
  const p = state.addMenuPos || {};
  addNode(type, p.x, p.y);
  hideContextMenu();
}

function showNodeContextMenu(e, nodeId) {
  e.preventDefault();
  e.stopPropagation();
  state.contextNode = nodeId;
  state.contextConn = null;

  const menu = document.getElementById('contextMenu');
  document.getElementById('ctxDeleteNode').style.display = '';
  document.getElementById('ctxDuplicateNode').style.display = '';
  document.getElementById('ctxDeleteConn').style.display = 'none';

  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.classList.add('show');

  // 确保菜单不超出视口
  setTimeout(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
  }, 0);
}

function showConnectionContextMenu(e, connId) {
  e.preventDefault();
  e.stopPropagation();
  state.contextConn = connId;
  state.contextNode = null;

  const menu = document.getElementById('contextMenu');
  document.getElementById('ctxDeleteNode').style.display = 'none';
  document.getElementById('ctxDuplicateNode').style.display = 'none';
  document.getElementById('ctxDeleteConn').style.display = '';

  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.classList.add('show');
}

function hideContextMenu() {
  document.getElementById('contextMenu').classList.remove('show');
  const addMenu = document.getElementById('addNodeMenu');
  if (addMenu) addMenu.classList.remove('show');
  state.contextNode = null;
  state.contextConn = null;
  state.addMenuPos = null;
}

function contextDeleteNode() {
  if (state.contextNode) {
    deleteNode(state.contextNode);
  }
  hideContextMenu();
}

function contextDuplicateNode() {
  if (!state.contextNode) { hideContextMenu(); return; }
  const node = state.nodes.find(n => n.id === state.contextNode);
  if (!node) { hideContextMenu(); return; }

  const newNode = addNode(node.type, node.x + 320, node.y);
  newNode.data = { ...node.data };
  refreshNodeBody(newNode);
  showToast('节点已复制', 'success');
  hideContextMenu();
}

function contextDeleteConn() {
  if (state.contextConn) {
    deleteConnection(state.contextConn);
  }
  hideContextMenu();
}
