/**
 * Notice: Some code was adapted from Material-UI's text field.
 *         Copyright (c) 2014 Call-Em-All (https://github.com/callemall/material-ui)
 */
import React, { type RefObject, type JSX } from 'react';
import { type IobTheme } from '@iobroker/adapter-react-v5';
interface ChipRendererProps {
    value: string;
    isFocused: boolean;
    isDisabled: boolean;
    isReadOnly: boolean;
    handleClick: () => void;
    handleDelete: () => void;
    style: React.CSSProperties;
}
export declare const defaultChipRenderer: ({ value, isFocused, isDisabled, isReadOnly, handleClick, handleDelete, style }: ChipRendererProps, key: string) => JSX.Element;
interface ChipInputProps {
    /** Allows duplicate chips if set to true. */
    allowDuplicates?: boolean;
    /** If true, the placeholder will always be visible. */
    alwaysShowPlaceholder?: boolean;
    /** Behavior when the chip input is blurred: `'clear'` clears the input, `'add'` creates a chip and `'ignore'` keeps the input. */
    blurBehavior?: 'clear' | 'add' | 'add-or-clear' | 'ignore';
    /** A function of the type `({ value, text, chip, isFocused, isDisabled, isReadOnly, handleClick, handleDelete, className }, key) => node` that returns a chip based on the given properties. This can be used to customize chip styles.  Each item in the `dataSource` array will be passed to `chipRenderer` as arguments `chip`, `value` and `text`. If `dataSource` is an array of objects and `dataSourceConfig` is present, then `value` and `text` will instead correspond to the object values defined in `dataSourceConfig`. If `dataSourceConfig` is not set and `dataSource` is an array of objects, then a custom `chipRenderer` must be set. `chip` is always the raw value from `dataSource`, either an object or a string. */
    chipRenderer?: (props: ChipRendererProps) => JSX.Element;
    /** Whether the input value should be cleared if the `value` prop is changed. */
    clearInputValueOnChange?: boolean;
    /** Data source for auto complete. This should be an array of strings or objects. */
    dataSource?: string[];
    /** The chips to display by default (for uncontrolled mode). */
    defaultValue?: string[];
    /** Whether to use `setTimeout` to delay adding chips in case other input events like `onSelection` need to fire first */
    delayBeforeAdd?: boolean;
    /** Disables the chip input if set to true. */
    disabled?: boolean;
    /** Disable the input underline. Only valid for 'standard' variant */
    disableUnderline?: boolean;
    /** Props to pass through to the `FormHelperText` component. */
    FormHelperTextProps?: Record<string, any>;
    /** If true, the chip input will fill the available width. */
    fullWidth?: boolean;
    /** If true, the input field will always be below the chips and fill the available space. By default, it will try to be beside the chips. */
    fullWidthInput?: boolean;
    /** Helper text that is displayed below the input. */
    helperText?: string | JSX.Element;
    /** Props to pass through to the `InputLabel`. */
    InputLabelProps?: Record<string, any>;
    /** Props to pass through to the `Input`. */
    InputProps?: Record<string, any>;
    /** Use this property to pass a ref callback to the native input component. */
    inputRef?: (el: HTMLInputElement) => void;
    /** The input value (enables controlled mode for the text input if set). */
    inputValue?: string;
    label?: string | JSX.Element;
    /** The key codes (`KeyboardEvent.keyCode`) used to determine when to create a new chip. */
    newChipKeyCodes?: number[];
    /** The keys (`KeyboardEvent.key`) used to determine when to create a new chip. */
    newChipKeys?: string[];
    /** Callback function that is called when a new chip was added (in controlled mode). */
    onAdd?: (chip: string) => void;
    /** Callback function that is called with the chip to be added and should return true to add the chip or false to prevent the chip from being added without clearing the text input. */
    onBeforeAdd?: (chip: string) => boolean;
    onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
    onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    onKeyUp?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    /** Callback function that is called when the chips change (in uncontrolled mode). */
    onChange?: (chips: string[]) => void;
    /** Callback function that is called when a new chip was removed (in controlled mode). */
    onDelete: (chip: string, i: number) => void;
    /** Callback function that is called when the input changes. */
    onUpdateInput?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    /** A placeholder that is displayed if the input has no values. */
    placeholder?: string;
    /** Makes the chip input read-only if set to true. */
    readOnly?: boolean;
    /** The chips to display (enables controlled mode if set). */
    value?: string[];
    /** The variant of the Input component */
    variant?: 'outlined' | 'standard' | 'filled';
    className?: string;
    error?: boolean;
    id?: string;
    required?: boolean;
    rootRef?: RefObject<HTMLDivElement>;
    margin?: 'dense' | 'normal' | 'none';
    theme: IobTheme;
}
interface ChipInputState {
    chips: string[];
    focusedChip: number | null;
    inputValue: string;
    isFocused: boolean;
    chipsUpdated: boolean;
    prevPropsValue: string[];
    variant: 'outlined' | 'standard' | 'filled';
}
export default class ChipInput extends React.Component<ChipInputProps, ChipInputState> {
    private readonly labelRef;
    private labelNode;
    private readonly input;
    private readonly newChipKeyCodes;
    private readonly newChipKeys;
    private actualInput;
    private inputBlurTimeout;
    private _keyPressed;
    private _preventChipCreation;
    private styles;
    private styleTheme;
    constructor(props: ChipInputProps);
    componentDidMount(): void;
    componentWillUnmount(): void;
    static getDerivedStateFromProps(props: ChipInputProps, state: ChipInputState): Partial<ChipInputState> | null;
    /**
     * Blurs this component.
     */
    /**
     * Focuses this component.
     */
    focus: () => void;
    handleInputBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
    handleInputFocus: (event: React.FocusEvent<HTMLInputElement>) => void;
    handleKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    handleKeyUp: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    handleUpdateInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
    /**
     * Handles adding a chip.
     *
     * @param chip Value of the chip, either a string or an object (if dataSourceConfig is set)
     * @param options Additional options
     * @param options.clearInputOnFail If `true`, and `onBeforeAdd` returns `false`, clear the input
     * @returns True if the chip was added (or at least `onAdd` was called), false if adding the chip was prevented
     */
    handleAddChip(chip: string, options?: {
        clearInputOnFail: boolean;
    }): boolean;
    handleDeleteChip(chip: string, i: number): void;
    updateChips(chips: string[], additionalUpdates?: {}): void;
    /**
     * Clears the text field for adding new chips.
     * This only works in uncontrolled input mode, i.e., if the inputValue prop is not used.
     */
    clearInput(): void;
    updateInput(value: string): void;
    /**
     * Set the reference to the actual input, that is the input of the Input.
     *
     * @param ref - The reference
     */
    setActualInputRef: (ref: HTMLInputElement) => void;
    render(): JSX.Element;
}
export {};
