import React, { Component, type JSX } from 'react';
import { type Connection, type ThemeType, type ThemeName, type IobTheme } from '@iobroker/adapter-react-v5';
import type { ConfigIconType, ConfigItemAny, ConfigItemConfirmData, JsonConfigContext } from '../types';
export declare function isObject(it: any): it is Record<string, any>;
export interface DeviceManagerPropsProps {
    socket: Connection;
    selectedInstance: string;
    registerHandler?: (handler: null | ((command: string) => void)) => void;
    themeName: ThemeName;
    theme: IobTheme;
    themeType: ThemeType;
    isFloatComma: boolean;
    dateFormat: string;
    /** Instance to upload images to, like `adapterName.X` */
    uploadImagesToInstance?: string;
    /** Filter devices with this string */
    filter?: string;
    /** If this component is used in GUI with own toolbar. `false` if this list is used with multiple instances and true if only with one (in this case, it will monitor alive itself */
    embedded?: boolean;
    /** If embedded, this text is shown in the toolbar */
    title?: string;
    /** Style of a component that displays all devices */
    style?: React.CSSProperties;
    /** Use small cards for devices */
    smallCards?: boolean;
}
export interface ConfigGenericProps {
    oContext: JsonConfigContext;
    alive: boolean;
    arrayIndex?: number;
    attr?: string;
    changed: boolean;
    className?: string;
    expertMode?: boolean;
    commandRunning?: boolean;
    common: Record<string, any>;
    custom?: boolean;
    customObj?: Record<string, any>;
    data: Record<string, any>;
    disabled?: boolean;
    globalData?: Record<string, any>;
    index?: number;
    isParentTab?: boolean;
    onChange: (attrOrData: string | Record<string, any>, val?: any, cb?: () => void, saveConfig?: boolean) => void;
    onError: (attr: string, error?: string) => void;
    originalData: Record<string, any>;
    /** This indicates that the component is the very firsts one - root */
    root?: boolean;
    /** Provided props by the specific component */
    schema: ConfigItemAny;
    style?: Record<string, any>;
    /** This item is in the table. Maybe some layouts must be changed */
    table?: boolean;
    themeName: ThemeName;
}
export interface ConfigGenericState {
    confirmDialog: boolean;
    confirmNewValue: any;
    confirmAttr: any;
    confirmData: ConfigItemConfirmData | null;
    value?: any;
    confirmDepAttr?: any;
    confirmDepNewValue?: any;
    confirmCallback: null | ((result: boolean) => void);
}
export default class ConfigGeneric<Props extends ConfigGenericProps = ConfigGenericProps, State extends ConfigGenericState = ConfigGenericState> extends Component<Props, State> {
    static DIFFERENT_VALUE: string;
    static DIFFERENT_LABEL: string;
    static NONE_VALUE: string;
    static NONE_LABEL: string;
    private readonly defaultValue;
    private isError;
    private readonly lang;
    private defaultSendToDone?;
    private sendToTimeout?;
    private noPlaceRequired;
    constructor(props: Props);
    componentDidMount(): void;
    sendTo(): void;
    componentWillUnmount(): void;
    onUpdate: (data: Record<string, any>) => void;
    /**
     * Extract attribute out of data
     */
    static getValue(data: Record<string, any>, attr: string | string[]): any;
    static setValue(data: Record<string, any>, attr: string | string[], value: any): void;
    getText(text: ioBroker.StringOrTranslated, noTranslation?: boolean): string;
    renderDialogConfirm(): JSX.Element | null;
    getIcon(iconSettings?: ConfigIconType | null): JSX.Element | null;
    /**
     * Trigger onChange, to activate save button on change
     *
     * @param attr the changed attribute
     * @param newValue new value of the attribute
     */
    onChangeAsync(attr: string, newValue: unknown): Promise<void>;
    /**
     * Trigger onChange, to activate save button on change
     *
     * @param attr the changed attribute
     * @param newValue new value of the attribute
     * @param cb optional callback function, else returns a Promise
     */
    onChange(attr: string, newValue: unknown, cb?: () => void): Promise<void>;
    execute(func: string | boolean | Record<string, string>, defaultValue: string | number | boolean, data: Record<string, any>, arrayIndex: number, globalData: Record<string, any>): string | number | boolean;
    executeCustom(func: string | boolean | Record<string, string>, data: Record<string, any>, customObj: Record<string, any>, instanceObj: ioBroker.InstanceObject, arrayIndex: number, globalData: Record<string, any>): string | boolean | number | null;
    calculate(schema: Record<string, any>): {
        error: boolean;
        disabled: boolean;
        hidden: boolean;
        defaultValue: null | string | number | boolean;
    };
    onError(attr: string, error?: string): void;
    renderItem(_error: unknown, _disabled: boolean, _defaultValue?: unknown): JSX.Element | string | null;
    renderHelp(text: ioBroker.StringOrTranslated, link: string, noTranslation: boolean): JSX.Element | JSX.Element[] | string;
    static escapeString(str: string, data: Record<string, any>): string;
    getPattern(pattern: string | {
        func: string;
    }, data?: Record<string, any>, noTranslation?: boolean): string;
    render(): string | JSX.Element | null;
}
