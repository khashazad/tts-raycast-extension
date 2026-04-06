export enum LaunchType {
  UserInitiated = "UserInitiated",
}

export async function showHUD(_message: string): Promise<void> {
  return;
}

export async function getSelectedText(): Promise<string> {
  return "";
}

export async function launchCommand(_options: unknown): Promise<void> {
  return;
}

export const MenuBarExtra = {
  Item: () => null,
};
