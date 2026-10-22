import type {
	NativeDialogFrame,
	NativeDialogList,
} from "../../ui/components/native-dialog-navigation";

export interface AddonTreeNode {
	GetData(): { addonIndex?: number; category?: string };
}

export interface AddonsDialogFrame extends NativeDialogFrame {
	Dropdown: NativeDialogFrame & {
		IsMenuOpen(): boolean;
		CloseMenu(): void;
		menu?: NativeDialogFrame;
	};
	ForceLoad: NativeDialogFrame;
	SearchBox: NativeDialogFrame;
	EnableAllButton: NativeDialogFrame;
	DisableAllButton: NativeDialogFrame;
	OkayButton: NativeDialogFrame;
	CancelButton: NativeDialogFrame;
	ScrollBox: NativeDialogList<AddonTreeNode>;
}
