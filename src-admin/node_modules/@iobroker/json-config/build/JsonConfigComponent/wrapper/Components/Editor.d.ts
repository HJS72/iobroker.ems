import { type JSX } from 'react';
import 'ace-builds/src-min-noconflict/mode-json';
import 'ace-builds/src-min-noconflict/mode-json5';
import 'ace-builds/src-min-noconflict/worker-json';
import 'ace-builds/src-min-noconflict/theme-clouds_midnight';
import 'ace-builds/src-min-noconflict/theme-chrome';
import 'ace-builds/src-min-noconflict/ext-language_tools';
interface EditorProps {
    fontSize?: number;
    value?: string;
    defaultValue?: string;
    mode?: 'json' | 'css' | 'html' | 'json5';
    name: string;
    onChange?: (newValue: string) => void;
    themeType: string;
    editValueMode?: boolean;
    error?: boolean;
}
declare function Editor(props: EditorProps): JSX.Element;
export default Editor;
