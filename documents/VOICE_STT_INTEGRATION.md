# Voice-to-Text (STT) External API Integration Tutorial
## Multi-Language & Whisper Model Selection (Including 22 Official Indian Languages)

This guide explains how to integrate the **Faster-Whisper Voice-to-Text** service into any external application (Web, Mobile, Desktop, or Backend microservice), with full support for dynamic Whisper model selection and all **22 official Indian languages**.

---

## 1. Overview & Architecture

* **Decoupled Architecture**: Speech-to-Text (STT) is completely separated from Groq LLM. You get pure, ultra-fast transcription (<100ms on GPU) without paying LLM token costs or latency overhead.
* **Pre-installed Dev PC Model**: The dev server is pre-configured with **`MODEL_NAME = "base"`** — a fast multilingual model capable of transcribing 99+ languages.
* **Dynamic Model Switching**: External clients can specify any model on-the-fly (`base`, `small`, `medium`, `large-v3-turbo`, etc.). The server dynamically loads and caches models in GPU VRAM without requiring a restart.
* **Standard HTTP REST**: No WebSockets or complex SDKs required. Audio is uploaded as standard `multipart/form-data`.
* **22 Official Indian Languages**: Whisper supports the 22 scheduled languages of India with native codes (`hi`, `bn`, `ta`, `te`, `mr`, `gu`, `kn`, etc.) or automatic language detection.

---

## 2. API Endpoints Reference

| Endpoint | Method | Content-Type | Description |
| :--- | :---: | :---: | :--- |
| **`/api/transcribe`** | `POST` | `multipart/form-data` | **Core Voice-to-Text**: Transcribes audio directly with Faster-Whisper. Accepts `language` and `model`. |

---

## 3. Core Voice-to-Text API (`POST /api/transcribe`)

### Request Details
* **URL**: `http://61.2.142.91:8024/api/transcribe`
* **Method**: `POST`
* **Content-Type**: `multipart/form-data`

### Form Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :---: | :---: | :---: | :--- |
| `audio` | File | **Yes** | — | Audio file binary (`.wav`, `.webm`, `.mp3`, `.m4a`, `.ogg`, `.flac`). |
| `language` | String | No | `auto` | Language code (e.g. `hi`, `ta`, `te`, `bn`, `en`), language number (`1`–`22`), or `auto` for automatic language detection. |
| `model` | String | No | `base` | Whisper model to use (`base`, `small`, `medium`, `large-v3-turbo`, `tiny`, `base.en`). |

### Success Response (`200 OK`)
```json
{
  "transcript": "नमस्ते, आप कैसे हैं? आज का मौसम बहुत अच्छा है।",
  "language": "hi",
  "language_probability": 0.982,
  "duration": 3.42,
  "stt_latency": 0.089,
  "rtf": 0.026,
  "speed_factor": 38.42,
  "device": "cuda",
  "model_name": "base"
}
```

### Response Field Descriptions
* **`transcript`**: The transcribed text in the original script (e.g. Devanagari, Tamil script, Telugu script, Latin, etc.).
* **`language`**: Detected or specified language code (e.g. `hi`, `ta`, `te`, `bn`, `en`).
* **`language_probability`**: Confidence score of the detected language (`0.0` to `1.0`).
* **`duration`**: Duration of the audio file in seconds.
* **`stt_latency`**: Execution time of the Faster-Whisper transcription in seconds.
* **`rtf`**: Real-Time Factor (`stt_latency / duration`). Values < 0.1 indicate >10x faster than real-time.
* **`speed_factor`**: Processing speed multiplier relative to real-time (e.g. `38.42x` real-time).
* **`device`**: Processing accelerator used (`cuda` GPU FP16 or `cpu` int8 fallback).
* **`model_name`**: The actual Whisper model used for inference (`base`, `small`, etc.).

---

## 4. 22 Official Indian Languages Reference Table

The server supports all 22 official scheduled languages of India. You can specify the language via its **Whisper Language Code**, its **Number (1–22)**, its **Language Name**, or omit it for **Auto-Detect**.

| No. | Indian Language | Whisper Language Code | Native Script | Recommended Model |
| :-: | :--- | :---: | :--- | :--- |
| **1** | **Hindi** | `hi` | हिन्दी (Devanagari) | `base` / `small` |
| **2** | **Bengali** | `bn` | বাংলা (Bengali) | `base` / `small` |
| **3** | **Tamil** | `ta` | தமிழ் (Tamil) | `base` / `small` |
| **4** | **Telugu** | `te` | తెలుగు (Telugu) | `base` / `small` |
| **5** | **Marathi** | `mr` | मराठी (Devanagari) | `base` / `small` |
| **6** | **Gujarati** | `gu` | ગુજરાતી (Gujarati) | `base` / `small` |
| **7** | **Kannada** | `kn` | ಕನ್ನಡ (Kannada) | `base` / `small` |
| **8** | **Malayalam** | `ml` | മലയാളം (Malayalam) | `base` / `small` |
| **9** | **Punjabi** | `pa` | ਪੰਜਾਬੀ (Gurmukhi) | `base` / `small` |
| **10** | **Urdu** | `ur` | اردو (Perso-Arabic) | `base` / `small` |
| **11** | **Assamese** | `as` | অসমীয়া (Assamese) | `base` / `small` |
| **12** | **Odia (Oriya)** | `or` | ଓଡ଼ିଆ (Odia) | `base` / `small` |
| **13** | **Nepali** | `ne` | नेपाली (Devanagari) | `base` / `small` |
| **14** | **Sanskrit** | `sa` | संस्कृतम् (Devanagari) | `base` / `small` |
| **15** | **Sindhi** | `sd` | سنڌي (Arabic / Devanagari) | `base` / `small` |
| **16** | **Kashmiri** | `ks` | کٲشُر (Perso-Arabic) | `base` / `small` |
| **17** | **Konkani** | `kok` | कोंकणी (Devanagari / Romi) | `base` / `small` |
| **18** | **Manipuri (Meitei)** | `mni` | মৈতৈলোন্ (Meitei Mayek) | `base` / `small` |
| **19** | **Bodo** | `brx` | बर' (Devanagari) | `base` / `small` |
| **20** | **Dogri** | `doi` | डोगरी (Devanagari) | `base` / `small` |
| **21** | **Santali** | `sat` | ᱥᱟᱱᱛᱟᱲᱤ (Ol Chiki) | `base` / `small` |
| **22** | **Maithili** | `mai` | मैथिली (Devanagari) | `base` / `small` |

---

## 5. Whisper Model Selection Guide

| Model Name | Type | VRAM / RAM | Speed on GPU | Best For |
| :--- | :---: | :---: | :---: | :--- |
| **`base`** *(Installed on Dev PC)* | Multilingual | ~140 MB | **Ultra Fast (~60–90ms)** | **Default recommendation.** Great balance of speed and accuracy for Indian languages and English. |
| **`tiny`** | Multilingual | ~75 MB | Extremely Fast (~30–50ms) | Ultra-lightweight setups with limited compute. |
| **`small`** | Multilingual | ~460 MB | Fast (~120–200ms) | Higher accuracy for regional accents, fast speech, or noisy environments. |
| **`medium`** | Multilingual | ~1.4 GB | Moderate (~350–600ms) | Production grade for complex Indic vocabulary and code-switching (Hinglish/Tanglish). |
| **`large-v3-turbo`** | Multilingual | ~1.5 GB | Fast (~250–400ms) | State-of-the-art multilingual accuracy with optimized inference speed. |
| **`base.en`** | English-Only | ~140 MB | Ultra Fast (~50–80ms) | Use **only** when transcribing pure English audio. |

---

## 6. JavaScript / Browser Implementation

```javascript
async function transcribeAudio(audioBlob, language = "auto", model = "base") {
  const SERVER_URL = "http://61.2.142.91:8024";
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");

  if (language && language !== "auto") {
    formData.append("language", language);
  }
  if (model) {
    formData.append("model", model);
  }

  const response = await fetch(`${SERVER_URL}/api/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || `STT Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}
```
