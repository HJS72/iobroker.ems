import { type JSX } from 'react';
import type { ConfigItemFileSelector } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigFileSelectorProps extends ConfigGenericProps {
    schema: ConfigItemFileSelector;
}
interface ConfigFileSelectorState extends ConfigGenericState {
    uploadFile?: boolean | 'dragging';
    uploadError?: boolean;
    files?: {
        name: string;
        size: string;
    }[];
    deleteFile?: string;
}
declare class ConfigFileSelector extends ConfigGeneric<ConfigFileSelectorProps, ConfigFileSelectorState> {
    private readonly dropzoneRef;
    private readonly imagePrefix;
    private objectID;
    private path;
    constructor(props: ConfigFileSelectorProps);
    componentDidMount(): void;
    onFolderChanged: (_id: string, fileName: string) => void;
    componentWillUnmount(): void;
    updateFiles(): Promise<void>;
    readFolder(folderName: string, files: {
        name: string;
        size: string;
    }[], filter: string): Promise<{
        name: string;
        size: string;
    }[]>;
    readFiles(pattern: string): Promise<{
        name: string;
        size: string;
    }[]>;
    onDrop(acceptedFiles: File[]): void;
    renderDeleteDialog(): JSX.Element | null;
    static base64ToArrayBuffer(base64: string): ArrayBufferLike;
    loadFile(): Promise<{
        file: string;
        mimeType: string;
    }>;
    play(): void;
    getFileIcon(item: {
        value: string;
        label: string;
        extension?: string;
    }): JSX.Element | null;
    renderItem(error: string, disabled: boolean): JSX.Element | null;
}
export default ConfigFileSelector;
