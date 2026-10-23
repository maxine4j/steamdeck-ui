import type {
	NativeDialogFrame,
	NativeDialogList,
	NativeDialogMenu,
} from "../../ui/components/native-dialog-navigation";
import type { LayoutFrame } from "../../ui/components/native-layout";

export interface PremadeControl
	extends NativeDialogFrame,
		Omit<LayoutFrame, "SetFrameStrata"> {
	menu?: NativeDialogMenu;
	IsMenuOpen?(): boolean;
	CloseMenu?(): void;
	GetMenuDescription?(): {
		AddMenuAcquiredCallback(
			callback: (this: void, menu: NativeDialogMenu) => void,
		): void;
		AddMenuReleasedCallback(
			callback: (this: void, menu: NativeDialogMenu) => void,
		): void;
	};
}
export interface PremadeResult {
	resultID?: number;
	startGroup?: boolean;
}
export interface PremadeSearch extends PremadeControl {
	SearchBox: PremadeControl;
	FilterButton: PremadeControl;
	RefreshButton: PremadeControl;
	BackButton: PremadeControl;
	BackToGroupButton?: PremadeControl;
	SignUpButton: PremadeControl;
	ScrollBox: PremadeControl &
		NativeDialogList<PremadeResult> & { StartGroupButton?: PremadeControl };
	shouldAlwaysShowCreateGroupButton?: boolean;
}
export interface PremadeCreation extends PremadeControl {
	Name: PremadeControl & { GetText(): string };
	GroupDropdown?: PremadeControl;
	ActivityDropdown?: PremadeControl;
	PlayStyleDropdown?: PremadeControl;
	ActivityFinder?: PremadeControl & {
		Dialog: {
			EntryBox: PremadeControl;
			ScrollBox: NativeDialogList<{ id: number }>;
			SelectButton: PremadeControl;
			CancelButton: PremadeControl;
		};
	};
	CancelButton?: PremadeControl;
	selectedActivity?: number;
	selectedGroup?: number;
	selectedPlaystyle?: number;
	generalPlaystyle?: number;
	editMode?: boolean;
}
export interface PremadeApplicantViewer extends PremadeControl {
	ScrollBox: PremadeControl & NativeDialogList<{ id: number }>;
	RefreshButton?: PremadeControl;
	AutoAcceptButton?: PremadeControl;
	RemoveEntryButton?: PremadeControl;
	EditButton?: PremadeControl;
	BrowseGroupsButton?: PremadeControl;
}
export type PremadeRoot = PremadeControl &
	LayoutFrame & {
		CategorySelection: PremadeCategories;
		SearchPanel: PremadeSearch;
		EntryCreation: PremadeCreation;
		ApplicationViewer: PremadeApplicantViewer;
		activePanel?: PremadeControl;
	};

export interface PremadeCategories extends PremadeControl {
	CategoryButtons: (PremadeControl & { categoryID: number; filters: number })[];
	FindGroupButton: PremadeControl;
	StartGroupButton: PremadeControl;
}

// FrameXML helpers are absent from generated API documentation. Verified in
// Blizzard_GroupFinder/Mainline/LFGList.lua and LFGList.xml (Retail).
declare global {
	function LFGListEntryCreation_ClearAutoCreateMode(
		this: void,
		panel: PremadeCreation,
	): void;
	function LFGListCategorySelection_SelectCategory(
		this: void,
		panel: PremadeCategories,
		category: number,
		filters: number,
	): void;
	function LFGListCategorySelectionFindGroupButton_OnClick(
		this: void,
		button: PremadeControl,
	): void;
	function LFGListCategorySelectionStartGroupButton_OnClick(
		this: void,
		button: PremadeControl,
	): void;
	function LFGListSearchPanel_SignUp(this: void, panel: PremadeSearch): void;
	const LFGListFrame: PremadeRoot;
	function LFGListFrame_SetBaseFilters(
		this: void,
		frame: PremadeRoot,
		filters: number,
	): void;
	function LFGListFrame_FixPanelValid(this: void, frame: PremadeRoot): void;
	function LFGListFrame_SetActivePanel(
		this: void,
		frame: PremadeRoot,
		panel: PremadeControl,
	): void;
}
