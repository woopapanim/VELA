// 공용 타입 — analyze/ 하위 컴포넌트 간 공유.

export type Translator = (k: string, params?: Record<string, string | number>) => string;
