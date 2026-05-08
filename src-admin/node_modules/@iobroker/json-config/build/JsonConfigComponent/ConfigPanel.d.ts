import { type JSX } from 'react';
import type { ConfigItemPanel } from '../types';
import ConfigGeneric, { type ConfigGenericState, type ConfigGenericProps } from './ConfigGeneric';
interface ConfigPanelProps extends ConfigGenericProps {
    schema: ConfigItemPanel;
    withIcons?: boolean;
    withoutSaveButtons?: boolean;
}
interface ConfigPanelState extends ConfigGenericState {
    expanded?: boolean;
}
declare class ConfigPanel extends ConfigGeneric<ConfigPanelProps, ConfigPanelState> {
    componentDidMount(): void;
    renderItems(items: Record<string, any>, disabled: boolean): JSX.Element[] | null;
    render(): JSX.Element | null;
}
export default ConfigPanel;
