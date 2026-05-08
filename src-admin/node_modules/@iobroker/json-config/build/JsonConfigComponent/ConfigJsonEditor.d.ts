import { type JSX } from 'react';
import type { ConfigItemJsonEditor } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigJsonEditorProps extends ConfigGenericProps {
    schema: ConfigItemJsonEditor;
}
interface ConfigJsonEditorState extends ConfigGenericState {
    initialized?: boolean;
    showSelectId?: boolean;
    jsonError?: boolean;
}
declare class ConfigJsonEditor extends ConfigGeneric<ConfigJsonEditorProps, ConfigJsonEditorState> {
    componentDidMount(): void;
    validateJson(value: string | null | undefined): boolean;
    renderItem(_error: string, disabled: boolean): JSX.Element | null;
}
export default ConfigJsonEditor;
