export type StreamDeckKeyActionType =
  | "none"
  | "open-url"
  | "launch-app"
  | "shell-command";

export interface StreamDeckKeyAction {
  type: StreamDeckKeyActionType;
  label?: string;
  url?: string;
  path?: string;
  args?: string;
  workingDirectory?: string;
  command?: string;
}
