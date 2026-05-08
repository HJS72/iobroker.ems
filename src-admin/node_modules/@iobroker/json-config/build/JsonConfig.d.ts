import React from 'react';
import { I18n, Router, type AdminConnection, type IobTheme, type ThemeName, type ThemeType } from '@iobroker/adapter-react-v5';
import type { ConfigItemAny, ConfigItemPanel, ConfigItemTabs } from './types';
import { type DeviceManagerPropsProps } from './JsonConfigComponent/ConfigGeneric';
interface JsonConfigProps {
    adapterName: string;
    instance: number;
    isFloatComma: boolean;
    dateFormat: string;
    secret?: string;
    socket: AdminConnection;
    theme: IobTheme;
    themeName: ThemeName;
    themeType: ThemeType;
    expertMode?: boolean;
    /** Translate method */
    t: typeof I18n.t;
    configStored: (notChanged: boolean) => void;
    width: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    DeviceManager?: React.FC<DeviceManagerPropsProps>;
}
interface JsonConfigState {
    schema?: ConfigItemPanel | ConfigItemTabs;
    data?: Record<string, unknown>;
    originalData?: Record<string, unknown>;
    updateData: number;
    common?: ioBroker.InstanceCommon;
    changed: boolean;
    confirmDialog: boolean;
    theme: IobTheme;
    saveConfigDialog: boolean;
    hash: string;
    error?: boolean;
}
declare class JsonConfig extends Router<JsonConfigProps, JsonConfigState> {
    private fileSubscribed;
    private fileLangSubscribed;
    private secret;
    constructor(props: JsonConfigProps);
    componentWillUnmount(): void;
    private handleFileSelect;
    getExportImportButtons(): JSX.Element;
    onFileChange: (id: string, fileName: string, size: number) => Promise<void>;
    getInstanceObject(): Promise<ioBroker.InstanceObject | null>;
    renderDialogConfirm(): JSX.Element | null;
    scanForInclude(json: Record<string, any>, filePaths: string[]): Promise<Record<string, any>>;
    getConfigFile(fileName?: string): Promise<ConfigItemPanel | ConfigItemTabs>;
    _getConfigFile(fileName?: string, _filePaths?: string[]): Promise<ConfigItemPanel | ConfigItemTabs>;
    renderSaveConfigDialog(): JSX.Element | null;
    findAttr(attr: string, schema?: ConfigItemPanel | ConfigItemTabs): ConfigItemAny | null;
    postProcessing(data: Record<string, unknown>, attr: string, schema: ConfigItemAny): void;
    onSave(doSave: boolean, close?: boolean): Promise<void>;
    componentDidUpdate(_prevProps: JsonConfigProps, prevState: JsonConfigState): void;
    /**
     * Validate the JSON config once on mount
     */
    componentDidMount(): Promise<void>;
    render(): JSX.Element;
}
export default JsonConfig;
