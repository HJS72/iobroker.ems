import { type JSX } from 'react';
import type { ConfigItemFile } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigFileProps extends ConfigGenericProps {
    schema: ConfigItemFile;
}
interface ConfigFileState extends ConfigGenericState {
    showFileBrowser?: boolean;
}
declare class ConfigFile extends ConfigGeneric<ConfigFileProps, ConfigFileState> {
    private imagePrefix;
    componentDidMount(): void;
    static getDerivedStateFromProps(props: ConfigFileProps, state: ConfigFileState): Partial<ConfigFileState> | null;
    loadFile(): Promise<{
        file: string;
        mimeType: string;
    } | null>;
    play(): void;
    getIcon(): JSX.Element | null;
    renderFileBrowser(): JSX.Element | null;
    renderItem(error: string, disabled: boolean): JSX.Element;
}
export default ConfigFile;
