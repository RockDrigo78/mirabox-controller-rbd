export type StreamDeckKeyActionType =
  | "none"
  | "open-url"
  | "launch-app"
  | "shell-command"
  | "previous-page"
  | "next-page";

export interface StreamDeckKeyAction {
  type: StreamDeckKeyActionType;
  label?: string;
  url?: string;
  path?: string;
  args?: string;
  workingDirectory?: string;
  command?: string;
}
