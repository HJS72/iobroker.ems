import React, { Component, type JSX } from 'react';
import { type AdminConnection, type ThemeName, type ThemeType, type IobTheme } from '@iobroker/adapter-react-v5';
import type { BackEndCommand, ConfigItemPanel, ConfigItemTabs } from '../types';
import type ConfigGeneric from './ConfigGeneric';
import { type DeviceManagerPropsProps } from './ConfigGeneric';
interface JsonConfigComponentProps {
    socket: AdminConnection;
    themeName: ThemeName;
    themeType: ThemeType;
    adapterName: string;
    instance: number;
    isFloatComma: boolean;
    dateFormat: string;
    imagePrefix?: string;
    schema: ConfigItemTabs | ConfigItemPanel;
    common?: Record<string, any>;
    data: Record<string, any>;
    updateData?: number;
    onError: (error: boolean) => void;
    onChange?: (data: Record<string, any>, changed: boolean, saveConfig: boolean) => void;
    /** Backend request to refresh data */
    onBackEndCommand?: (command?: BackEndCommand) => void;
    custom?: boolean;
    onValueChange?: (attr: string, value: any, saveConfig: boolean) => void;
    embedded?: boolean;
    multiEdit?: boolean;
    instanceObj?: ioBroker.InstanceObject;
    customObj?: ioBroker.Object;
    customs?: Record<string, typeof ConfigGeneric>;
    DeviceManager?: React.FC<DeviceManagerPropsProps>;
    style?: React.CSSProperties;
    theme: IobTheme;
    expertMode?: boolean;
    withoutSaveButtons?: boolean;
}
interface JsonConfigComponentState {
    originalData: string;
    changed: boolean;
    errors: Record<string, string>;
    systemConfig: ioBroker.SystemConfigCommon | null;
    updateData?: number;
    alive: boolean;
    commandRunning: boolean;
    schema: ConfigItemTabs | ConfigItemPanel;
}
export declare class JsonConfigComponent extends Component<JsonConfigComponentProps, JsonConfigComponentState> {
    private readonly forceUpdateHandlers;
    private errorTimeout;
    private errorCached;
    private oContext;
    constructor(props: JsonConfigComponentProps);
    static getDerivedStateFromProps(props: JsonConfigComponentProps, state: JsonConfigComponentState): Partial<JsonConfigComponentState> | null;
    static loadI18n(socket: AdminConnection, i18n: boolean | string | Record<string, Record<ioBroker.Languages, string>>, adapterName: string): Promise<string>;
    onCommandRunning: (commandRunning: boolean) => void;
    readData(): void;
    onAlive: (_id: string, state?: ioBroker.State | null) => void;
    onChange: (attrOrData: string | Record<string, any>, value: any, cb?: () => void, saveConfig?: boolean) => void;
    onError: (attr: string, error?: string) => void;
    flatten(schema: Record<string, any>, _list?: Record<string, any>): Record<string, any>;
    buildDependencies(schema: ConfigItemTabs | ConfigItemPanel): void;
    updateContext(forceUpdate?: boolean): void;
    renderItem(item: ConfigItemTabs | ConfigItemPanel): JSX.Element | null;
    changeLanguage: () => void;
    forceAttrUpdate: (attr: string | string[], data: any) => void;
    registerOnForceUpdate: (attr: string, cb?: ((data: any) => void) | null) => void;
    render(): JSX.Element;
}
export default JsonConfigComponent;
