import { type JSX } from 'react';
import type { ConfigItemAccordion } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigAccordionProps extends ConfigGenericProps {
    schema: ConfigItemAccordion;
}
interface ConfigAccordionState extends ConfigGenericState {
    value: Record<string, any>[];
    activeIndex: number;
    iteration: number;
    accordionErrors: Record<number, Record<string, string>>;
}
declare class ConfigAccordion extends ConfigGeneric<ConfigAccordionProps, ConfigAccordionState> {
    private typingTimer;
    constructor(props: ConfigAccordionProps);
    componentDidMount(): void;
    componentWillUnmount(): void;
    onAccordionError: (accordionIndex: number) => (attr: string, error?: string) => void;
    hasAccordionErrors: (accordionIndex: number) => boolean;
    itemAccordion(data: Record<string, any>, idx: number): JSX.Element;
    onDelete: (index: number) => () => void;
    onClone: (index: number) => () => void;
    onChangeWrapper: (newValue: any) => void;
    onAdd: () => void;
    onMoveUp(idx: number): void;
    onMoveDown(idx: number): void;
    onExport: () => void;
    onImport: (replace: boolean) => void;
    renderItem(): JSX.Element | null;
}
export default ConfigAccordion;
