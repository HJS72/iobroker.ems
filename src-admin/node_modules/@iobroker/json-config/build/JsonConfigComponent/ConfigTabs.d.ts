import { type JSX } from 'react';
import type { ConfigItemTabs } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigTabsProps extends ConfigGenericProps {
    schema: ConfigItemTabs;
    dialogName?: string;
    withoutSaveButtons?: boolean;
}
interface ConfigTabsState extends ConfigGenericState {
    tab?: string;
    width: number;
    openMenu: HTMLButtonElement | null;
    initialBreakpoint?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    tabErrors: Record<string, Record<string, string>>;
}
declare class ConfigTabs extends ConfigGeneric<ConfigTabsProps, ConfigTabsState> {
    private resizeTimeout;
    private readonly refDiv;
    constructor(props: ConfigTabsProps);
    onTabError: (attr: string, error?: string) => void;
    hasTabErrors: (tabName: string) => boolean;
    componentWillUnmount(): void;
    onHashTabsChanged: () => void;
    getCurrentBreakpoint(): 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    componentDidUpdate(): void;
    onMenuChange(tab: string): void;
    render(): JSX.Element;
}
export default ConfigTabs;
