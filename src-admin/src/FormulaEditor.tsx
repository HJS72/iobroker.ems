import React, { useEffect, useMemo, useState } from 'react';
import {
    Autocomplete,
    Box,
    Button,
    Chip,
    IconButton,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import type { ConfigGenericProps } from '@iobroker/json-config';

type Term = {
    op: '+' | '-';
    id: string;
};

function parseFormula(formula: string): Term[] {
    const compact = String(formula || '').trim();
    if (!compact) {
        return [{ op: '+', id: '' }];
    }

    const tokens = compact.split(/([+-])/).map(token => token.trim()).filter(Boolean);
    const terms: Term[] = [];
    let nextOp: '+' | '-' = '+';

    for (const token of tokens) {
        if (token === '+' || token === '-') {
            nextOp = token;
            continue;
        }

        terms.push({ op: terms.length === 0 ? '+' : nextOp, id: token });
        nextOp = '+';
    }

    return terms.length ? terms : [{ op: '+', id: '' }];
}

function buildFormula(terms: Term[]): string {
    let out = '';
    for (const term of terms) {
        const id = term.id.trim();
        if (!id) {
            continue;
        }
        if (out) {
            out += ` ${term.op === '-' ? '-' : '+'} `;
        }
        out += id;
    }
    return out;
}

export default function FormulaEditor(props: ConfigGenericProps): React.JSX.Element {
    const value = String((props.data && props.attr && props.data[props.attr]) || '');
    const [terms, setTerms] = useState<Term[]>(() => parseFormula(value));
    const [stateIds, setStateIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setTerms(parseFormula(value));
    }, [value]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        void props.oContext.socket.getObjectViewSystem('state', '', '\u9999').then(objects => {
            if (!active) {
                return;
            }
            const ids = Object.keys(objects)
                .filter(id => objects[id]?.common?.type === 'number')
                .sort((a, b) => a.localeCompare(b));
            setStateIds(ids);
            setLoading(false);
        }).catch(() => {
            if (active) {
                setLoading(false);
            }
        });

        return () => {
            active = false;
        };
    }, [props.oContext.socket]);

    const formulaPreview = useMemo(() => buildFormula(terms), [terms]);

    const updateTerms = (nextTerms: Term[]): void => {
        setTerms(nextTerms);
        props.onChange(props.attr || 'berechnungFormula', buildFormula(nextTerms));
    };

    const setTermId = (index: number, id: string): void => {
        const next = [...terms];
        next[index] = { ...next[index], id };
        updateTerms(next);
    };

    const setTermOp = (index: number, op: '+' | '-'): void => {
        const next = [...terms];
        next[index] = { ...next[index], op };
        updateTerms(next);
    };

    const addTerm = (): void => {
        updateTerms([...terms, { op: '+', id: '' }]);
    };

    const removeTerm = (index: number): void => {
        const next = terms.filter((_, idx) => idx !== index);
        updateTerms(next.length ? next : [{ op: '+', id: '' }]);
    };

    return (
        <Box sx={{ width: '100%', minWidth: 360 }}>
            <Stack spacing={1}>
                {terms.map((term, index) => (
                    <Stack key={index} direction="row" spacing={1} alignItems="center">
                        <TextField
                            select
                            size="small"
                            label={index === 0 ? 'Start' : 'Operator'}
                            value={index === 0 ? '+' : term.op}
                            disabled={index === 0}
                            onChange={event => setTermOp(index, event.target.value as '+' | '-')}
                            sx={{ width: 110 }}
                        >
                            <MenuItem value="+">+</MenuItem>
                            <MenuItem value="-">-</MenuItem>
                        </TextField>
                        <Autocomplete
                            freeSolo
                            loading={loading}
                            options={stateIds}
                            value={term.id}
                            onInputChange={(_event, newInputValue) => setTermId(index, newInputValue)}
                            onChange={(_event, newValue) => setTermId(index, typeof newValue === 'string' ? newValue : newValue || '')}
                            renderInput={params => (
                                <TextField
                                    {...params}
                                    size="small"
                                    label="Datenpunkt"
                                    placeholder="ems.0.grid"
                                />
                            )}
                            sx={{ flexGrow: 1 }}
                        />
                        <IconButton onClick={() => removeTerm(index)} disabled={terms.length === 1}>
                            <DeleteIcon />
                        </IconButton>
                    </Stack>
                ))}
                <Stack direction="row" spacing={1} alignItems="center">
                    <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addTerm}>
                        Term
                    </Button>
                    <Chip label={formulaPreview || 'Noch keine gueltige Formel'} size="small" variant="outlined" />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                    Numerische Datenpunkte auswaehlen oder direkt eintippen. Die Formel wird automatisch als String gespeichert.
                </Typography>
            </Stack>
        </Box>
    );
}