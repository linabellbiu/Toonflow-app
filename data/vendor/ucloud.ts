/**
 * Toonflow AI供应商模板 - UCloud UModelVerse (AstraFlow)
 * @version 1.0
 */

// ============================================================
// 类型定义
// ============================================================

type VideoMode =
  | "singleImage"
  | "startEndRequired"
  | "endFrameOptional"
  | "startFrameOptional"
  | "text"
  | (`videoReference:${number}` | `imageReference:${number}` | `audioReference:${number}`)[];

interface TextModel {
  name: string;
  modelName: string;
  type: "text";
  think: boolean;
}

interface ImageModel {
  name: string;
  modelName: string;
  type: "image";
  mode: ("text" | "singleImage" | "multiReference")[];
  associationSkills?: string;
}

interface VideoModel {
  name: string;
  modelName: string;
  type: "video";
  mode: VideoMode[];
  associationSkills?: string;
  audio: "optional" | false | true;
  durationResolutionMap: { duration: number[]; resolution: string[] }[];
}

interface TTSModel {
  name: string;
  modelName: string;
  type: "tts";
  voices: { title: string; voice: string }[];
}

interface VendorConfig {
  id: string;
  version: string;
  name: string;
  author: string;
  description?: string;
  icon?: string;
  inputs: { key: string; label: string; type: "text" | "password" | "url"; required: boolean; placeholder?: string }[];
  inputValues: Record<string, string>;
  models: (TextModel | ImageModel | VideoModel | TTSModel)[];
}

type ReferenceList =
  | { type: "image"; sourceType: "base64"; base64: string }
  | { type: "audio"; sourceType: "base64"; base64: string }
  | { type: "video"; sourceType: "base64"; base64: string };

interface ImageConfig {
  prompt: string;
  referenceList?: Extract<ReferenceList, { type: "image" }>[];
  size: "1K" | "2K" | "4K";
  aspectRatio: `${number}:${number}`;
}

interface VideoConfig {
  duration: number;
  resolution: string;
  aspectRatio: "16:9" | "9:16";
  prompt: string;
  referenceList?: ReferenceList[];
  audio?: boolean;
  mode: VideoMode[];
}

interface TTSConfig {
  text: string;
  voice: string;
  speechRate: number;
  pitchRate: number;
  volume: number;
  referenceList?: Extract<ReferenceList, { type: "audio" }>[];
}

interface PollResult {
  completed: boolean;
  data?: string;
  error?: string;
}

// ============================================================
// 全局声明
// ============================================================

declare const axios: any;
declare const logger: (msg: string) => void;
declare const jsonwebtoken: any;
declare const zipImage: (base64: string, size: number) => Promise<string>;
declare const zipImageResolution: (base64: string, w: number, h: number) => Promise<string>;
declare const mergeImages: (base64Arr: string[], maxSize?: string) => Promise<string>;
declare const urlToBase64: (url: string) => Promise<string>;
declare const pollTask: (fn: () => Promise<PollResult>, interval?: number, timeout?: number) => Promise<PollResult>;
declare const createOpenAI: any;
declare const createDeepSeek: any;
declare const createZhipu: any;
declare const createQwen: any;
declare const createAnthropic: any;
declare const createOpenAICompatible: any;
declare const createXai: any;
declare const createMinimax: any;
declare const createGoogleGenerativeAI: any;
declare const exports: {
  vendor: VendorConfig;
  textRequest: (m: TextModel, t: boolean, tl: 0 | 1 | 2 | 3) => any;
  imageRequest: (c: ImageConfig, m: ImageModel) => Promise<string>;
  videoRequest: (c: VideoConfig, m: VideoModel) => Promise<string>;
  ttsRequest: (c: TTSConfig, m: TTSModel) => Promise<string>;
  checkForUpdates?: () => Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }>;
  updateVendor?: () => Promise<string>;
};

// ============================================================
// 供应商配置
// ============================================================

const vendor: VendorConfig = {
  id: "ucloud",
  version: "2.1",
  author: "Toonflow",
  name: "UCloud 豆包",
  description:
    "## UCloud UModelVerse（AstraFlow）\n\n接入 UCloud 模型服务平台，OpenAI 兼容接口。\n\n- 控制台：[AstraFlow](https://astraflow.ucloud.cn)\n- 文档：[文本](https://astraflow.ucloud.cn/docs/modelverse/api_doc/text_api/openai_compatible) / [图像](https://astraflow.ucloud.cn/docs/modelverse/api_doc/image_api/doubao-seedream) / [视频](https://astraflow.ucloud.cn/docs/modelverse/api_doc/video_api/doubao-seedance-2-0-260128)\n\n需要在 AstraFlow 平台 → API Keys 页面获取密钥（sk-... 格式）。",
  inputs: [
    { key: "apiKey", label: "API Key", type: "password", required: true, placeholder: "在 AstraFlow 控制台获取（sk-... 格式）" },
    { key: "baseUrl", label: "请求地址", type: "url", required: true, placeholder: "默认：https://api.modelverse.cn" },
  ],
  inputValues: {
    apiKey: "",
    baseUrl: "https://api.modelverse.cn",
  },
  models: [
    // ===================== 文本模型 =====================
    { name: "Doubao-Seed-2.0-Pro", modelName: "doubao-seed-2-0-pro-260215", type: "text", think: true },
    // ===================== 图像模型 =====================
    {
      name: "Seedream-4.5",
      modelName: "doubao-seedream-4.5",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
    },
    // ===================== 视频模型 =====================
    {
      name: "Seedance-2.0(音画同生)",
      modelName: "doubao-seedance-2-0-260128",
      type: "video",
      mode: ["text", "startFrameOptional", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p", "1080p"] }],
    },
  ],
};

// ============================================================
// 辅助工具
// ============================================================

const getHeaders = (): Record<string, string> => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少 API Key");
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
};

const getBaseUrl = (): string => vendor.inputValues.baseUrl.replace(/\/+$/, "") || "https://api.modelverse.cn";

// ============================================================
// 适配器函数
// ============================================================

const textRequest = (model: TextModel, think: boolean, thinkLevel: 0 | 1 | 2 | 3) => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少 API Key");
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");
  const baseUrl = getBaseUrl();

  const effortMap: Record<number, string> = { 0: "minimal", 1: "low", 2: "medium", 3: "high" };

  return createOpenAICompatible({
    name: "ucloud",
    baseURL: `${baseUrl}/v1`,
    apiKey,
    fetch: async (url: string, options?: RequestInit) => {
      const rawBody = JSON.parse((options?.body as string) ?? "{}");
      const modifiedBody: any = { ...rawBody };
      if (think) {
        modifiedBody.thinking = { type: "enabled" };
        modifiedBody.reasoning_effort = effortMap[thinkLevel] ?? "medium";
      }
      return await fetch(url, { ...options, body: JSON.stringify(modifiedBody) });
    },
  }).chatModel(model.modelName);
};

// Seedream 像素映射表：根据 size + aspectRatio 计算目标分辨率
const imageRequest = async (config: ImageConfig, model: ImageModel): Promise<string> => {
  const baseUrl = getBaseUrl();
  const headers = getHeaders();

  // UCloud Seedream 总像素范围 [3686400, 16777216]，即 2K~4K
  const sizeTable: Record<string, Record<string, string>> = {
    "2K": {
      "1:1": "2048x2048",
      "4:3": "2304x1728",
      "3:4": "1728x2304",
      "16:9": "2560x1440",
      "9:16": "1440x2560",
      "3:2": "2496x1664",
      "2:3": "1664x2496",
      "21:9": "3136x1344",
    },
    "4K": {
      "1:1": "4096x4096",
      "4:3": "4704x3520",
      "3:4": "3520x4704",
      "16:9": "5504x3040",
      "9:16": "3040x5504",
      "3:2": "4992x3328",
      "2:3": "3328x4992",
      "21:9": "6240x2656",
    },
  };

  // 参考图：UCloud images 字段接受 URL 或 Base64（带 data: 前缀），最多 14 张
  const images: string[] = (config.referenceList || []).slice(0, 14).map((ref) => ref.base64);

  // 尺寸：1K 不在 Seedream 支持范围内，统一升到 2K
  const sizeKey = config.size === "4K" ? "4K" : "2K";
  const ratioKey = config.aspectRatio;
  const table = sizeTable[sizeKey];
  const size = (table && table[ratioKey]) || "2048x2048";

  const body: any = {
    model: model.modelName,
    prompt: config.prompt || "",
    size,
    watermark: false,
    stream: false,
    response_format: "url",
  };
  if (images.length > 0) body.images = images;

  logger(`[UCloud图像] 模型: ${model.modelName}, 尺寸: ${size}, 参考图: ${images.length} 张`);

  const res = await fetch(`${baseUrl}/v1/images/generations`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`UCloud 图像请求失败: ${errorText}`);
  }
  const response = await res.json();
  logger(response);

  if (response?.error) {
    throw new Error(`图像生成失败: ${response.error.message || response.error.code || JSON.stringify(response.error)}`);
  }

  const item = response?.data?.[0];
  if (item?.b64_json) return item.b64_json;
  if (item?.url) return await urlToBase64(item.url);

  throw new Error("图像生成失败：未返回有效结果");
};

const videoRequest = async (config: VideoConfig, model: VideoModel): Promise<string> => {
  const baseUrl = getBaseUrl();
  const headers = getHeaders();

  // 构造 input.content 数组
  const content: any[] = [];

  if (config.prompt) {
    content.push({ type: "text", text: config.prompt });
  }

  const currentMode = config.mode;
  const imageRefs = (config.referenceList || []).filter((r) => r.type === "image");
  const videoRefs = (config.referenceList || []).filter((r) => r.type === "video");
  const audioRefs = (config.referenceList || []).filter((r) => r.type === "audio");

  const isTextMode = currentMode.includes("text" as any);
  const isSingleImage = currentMode.includes("singleImage" as any);
  const isStartEndRequired = currentMode.includes("startEndRequired" as any);
  const isEndFrameOptional = currentMode.includes("endFrameOptional" as any);
  const isStartFrameOptional = currentMode.includes("startFrameOptional" as any);
  const multiRefDef = Array.isArray(currentMode) ? currentMode.find((m) => Array.isArray(m)) : null;

  if (isSingleImage && imageRefs.length > 0) {
    content.push({ type: "image_url", image_url: { url: imageRefs[0].base64 }, role: "first_frame" });
  } else if (isStartEndRequired && imageRefs.length >= 2) {
    content.push({ type: "image_url", image_url: { url: imageRefs[0].base64 }, role: "first_frame" });
    content.push({ type: "image_url", image_url: { url: imageRefs[1].base64 }, role: "last_frame" });
  } else if (isEndFrameOptional && imageRefs.length > 0) {
    content.push({ type: "image_url", image_url: { url: imageRefs[0].base64 }, role: "first_frame" });
    if (imageRefs.length > 1) {
      content.push({ type: "image_url", image_url: { url: imageRefs[1].base64 }, role: "last_frame" });
    }
  } else if (isStartFrameOptional && imageRefs.length > 0) {
    if (imageRefs.length >= 2) {
      content.push({ type: "image_url", image_url: { url: imageRefs[0].base64 }, role: "first_frame" });
      content.push({ type: "image_url", image_url: { url: imageRefs[1].base64 }, role: "last_frame" });
    } else {
      content.push({ type: "image_url", image_url: { url: imageRefs[0].base64 }, role: "first_frame" });
    }
  } else if (multiRefDef && Array.isArray(multiRefDef)) {
    for (const refDef of multiRefDef) {
      if (typeof refDef !== "string") continue;
      if (refDef.startsWith("imageReference:")) {
        const maxCount = parseInt(refDef.split(":")[1], 10);
        for (const ref of imageRefs.slice(0, maxCount)) {
          content.push({ type: "image_url", image_url: { url: ref.base64 }, role: "reference_image" });
        }
      } else if (refDef.startsWith("videoReference:")) {
        const maxCount = parseInt(refDef.split(":")[1], 10);
        for (const ref of videoRefs.slice(0, maxCount)) {
          content.push({ type: "video_url", video_url: { url: ref.base64 }, role: "reference_video" });
        }
      } else if (refDef.startsWith("audioReference:")) {
        const maxCount = parseInt(refDef.split(":")[1], 10);
        for (const ref of audioRefs.slice(0, maxCount)) {
          content.push({ type: "audio_url", audio_url: { url: ref.base64 }, role: "reference_audio" });
        }
      }
    }
  }

  if (isTextMode && content.length === 0) {
    throw new Error("文生视频模式需要提供提示词");
  }

  const parameters: any = {
    duration: config.duration,
    resolution: config.resolution || "720p",
    ratio: config.aspectRatio,
    watermark: false,
    generate_audio: config.audio === true,
  };

  const body: any = {
    model: model.modelName,
    input: { content },
    parameters,
  };

  logger(`[UCloud视频] 提交任务 模型: ${model.modelName}, 时长: ${config.duration}s, 分辨率: ${parameters.resolution}, 比例: ${parameters.ratio}`);

  const submitResp = await axios.post(`${baseUrl}/v1/tasks/submit`, body, { headers });
  const submitData = submitResp.data || {};

  const taskId = submitData?.output?.task_id;
  if (!taskId) {
    throw new Error(`视频任务创建失败: ${JSON.stringify(submitData)}`);
  }
  logger(`[UCloud视频] 任务已提交, ID: ${taskId}`);

  const result = await pollTask(
    async (): Promise<PollResult> => {
      const queryResp = await axios.get(`${baseUrl}/v1/tasks/status`, {
        params: { task_id: taskId },
        headers,
      });
      const data = queryResp.data || {};
      const out = data.output || {};
      const status = out.task_status;
      logger(`[UCloud视频] 任务 ${taskId} 状态: ${status}`);

      if (status === "Success") {
        const urls: string[] = out.urls || [];
        if (urls.length === 0) {
          return { completed: true, error: "任务成功但未返回视频URL" };
        }
        return { completed: true, data: urls[0] };
      }
      if (status === "Failure") {
        return { completed: true, error: out.error?.message || out.error || "视频生成失败" };
      }
      if (status === "Expired") {
        return { completed: true, error: "视频生成任务超时" };
      }
      return { completed: false };
    },
    10000,
    1800000,
  );

  if (result.error) throw new Error(result.error);

  logger(`[UCloud视频] 任务完成，转换视频为 base64...`);
  return await urlToBase64(result.data!);
};

const ttsRequest = async (config: TTSConfig, model: TTSModel): Promise<string> => {
  return "";
};

const checkForUpdates = async (): Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }> => {
  return { hasUpdate: false, latestVersion: "2.1", notice: "" };
};

const updateVendor = async (): Promise<string> => {
  return "";
};

// ============================================================
// 导出
// ============================================================

exports.vendor = vendor;
exports.textRequest = textRequest;
exports.imageRequest = imageRequest;
exports.videoRequest = videoRequest;
exports.ttsRequest = ttsRequest;
exports.checkForUpdates = checkForUpdates;
exports.updateVendor = updateVendor;

export {};
