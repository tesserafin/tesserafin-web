import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { type FC, memo, useEffect, useRef, useState } from 'react';

import globalize from 'lib/globalize';
import locales from 'lib/globalize/locales';
import type { TextSlotId, ThemeTextSlots } from 'themes/platform/contract';
import {
    slotTemplateError,
    slotTemplateWarning,
    TEXT_SLOT_IDS,
    TEXT_SLOTS
} from 'themes/platform/textSlots';

const normalise = (locale: string) => locale.replace('_', '-').toLowerCase();

/** Every supported locale, normalised the way the contract keys them. */
const LOCALES = locales.map((entry) => ({
    id: normalise(entry.lang),
    path: entry.path
}));

const FALLBACK_LOCALE = 'en-us';

type Dictionary = Readonly<Record<string, string>>;

/**
 * The application's own dictionary for a locale, loaded on demand — the same files globalize loads,
 * so "application text" here is exactly what a user of that language sees.
 */
async function loadDictionary(locale: string): Promise<Dictionary> {
    const entry = LOCALES.find((candidate) => candidate.id === locale);
    if (!entry) return {};
    try {
        const module = await import(
            /* webpackChunkName: "[request]" */ `../../../../../strings/${entry.path}`
        );
        return (module.default ?? module) as Dictionary;
    } catch {
        return {};
    }
}

/** `Recently Added in {0}` → `Recently Added in {libraryName}`: the author's names, not positions. */
const toNamed = (text: string, variables: readonly string[] = []) =>
    variables.reduce(
        (result, name, index) => result.split(`{${index}}`).join(`{${name}}`),
        text
    );

/**
 * The interface language's own wording, through globalize: `translateWithLocale` says whether the
 * key was in that language's dictionary or came from the English fallback.
 */
const INTERFACE_DICTIONARY = 'interface' as const;

const PAGES = [
    { id: 'home', title: 'Home' },
    { id: 'library', title: 'Library' },
    { id: 'itemDetails', title: 'Item Details' }
] as const;

export interface TextSlotsEditorProps {
    slots: ThemeTextSlots | undefined;
    onChange: (slots: ThemeTextSlots) => void;
}

/**
 * THEME-A2's text slots: the wording of a closed set of titles and labels, per language
 * (`docs/tesserafin/design-theme-text-slots.md` §8).
 *
 * Each field shows where the current words come from, what the application would say in the
 * language being edited, and why a value is refused. Reset removes that language's entry, which is
 * how a slot goes back to inheriting; clearing the field is not a reset (an empty text is refused).
 */
const TextSlotsEditorFields: FC<TextSlotsEditorProps> = ({
    slots,
    onChange
}) => {
    const interfaceLocale = globalize.getCurrentLocale();
    const [locale, setLocale] = useState(interfaceLocale);
    const [dictionaries, setDictionaries] = useState<{
        own: Dictionary;
        fallback: Dictionary;
    } | null>(null);

    useEffect(() => {
        let current = true;
        setDictionaries(null);
        // The interface language is already loaded: globalize answers for it synchronously.
        if (locale === interfaceLocale) return;
        void Promise.all([
            loadDictionary(locale),
            loadDictionary(FALLBACK_LOCALE)
        ]).then(([own, fallback]) => {
            if (current) setDictionaries({ own, fallback });
        });
        return () => {
            current = false;
        };
    }, [locale, interfaceLocale]);

    const setTemplate = (slot: TextSlotId, value: string | undefined) => {
        const entry = { ...slots?.[slot] };
        if (value === undefined) delete entry[locale];
        else entry[locale] = value;
        onChange({ ...slots, [slot]: entry });
    };

    const languagesWithText = [
        ...new Set(
            Object.values(slots ?? {}).flatMap((entry) => Object.keys(entry))
        )
    ].sort();

    return (
        <Stack spacing={2} data-testid='theme-studio-text-editor'>
            <Typography variant='body2' color='text.secondary'>
                The words of a few titles and labels, per language. Names of
                films, libraries and people are data and never change here. A
                text set for one language is never shown in another.
            </Typography>

            <FormControl fullWidth size='small'>
                <InputLabel id='text-slots-language'>Language</InputLabel>
                <Select
                    labelId='text-slots-language'
                    label='Language'
                    value={locale}
                    onChange={(event) => setLocale(String(event.target.value))}
                >
                    {LOCALES.map((entry) => (
                        <MenuItem key={entry.id} value={entry.id}>
                            {entry.id}
                            {entry.id === interfaceLocale ? ' (interface)' : ''}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <Typography variant='body2' color='text.secondary'>
                {languagesWithText.length
                    ? `Texts set for: ${languagesWithText.join(', ')}. Other languages use the application's wording.`
                    : "No text set yet: every language uses the application's wording."}
            </Typography>

            {locale !== interfaceLocale && (
                <Alert severity='info' variant='outlined'>
                    The preview shows the interface language ({interfaceLocale}
                    ). Text written for {locale} appears to people using{' '}
                    {locale}.
                </Alert>
            )}

            {PAGES.map((page) => (
                <Stack key={page.id} spacing={1.5}>
                    <Typography variant='h4' component='h4'>
                        {page.title}
                    </Typography>
                    {TEXT_SLOT_IDS.filter(
                        (slot) => TEXT_SLOTS[slot].page === page.id
                    ).map((slot) => (
                        <SlotField
                            key={slot}
                            slot={slot}
                            locale={locale}
                            value={slots?.[slot]?.[locale]}
                            dictionaries={
                                locale === interfaceLocale
                                    ? INTERFACE_DICTIONARY
                                    : dictionaries
                            }
                            onChange={(value) => setTemplate(slot, value)}
                        />
                    ))}
                </Stack>
            ))}
        </Stack>
    );
};

interface SlotFieldProps {
    slot: TextSlotId;
    locale: string;
    value: string | undefined;
    dictionaries:
        | { own: Dictionary; fallback: Dictionary }
        | typeof INTERFACE_DICTIONARY
        | null;
    onChange: (value: string | undefined) => void;
}

const SlotField: FC<SlotFieldProps> = ({
    slot,
    locale,
    value,
    dictionaries,
    onChange
}) => {
    const definition = TEXT_SLOTS[slot];
    const input = useRef<HTMLInputElement>(null);
    const id = `text-slot-${slot.replace(/\./g, '-')}`;

    let own: string | undefined;
    let fallback: string | undefined;
    if (dictionaries === INTERFACE_DICTIONARY) {
        const { text, lang } = globalize.translateWithLocale(definition.key);
        if (lang === locale) own = text;
        else fallback = text;
    } else {
        own = dictionaries?.own[definition.key];
        fallback = dictionaries?.fallback[definition.key];
    }
    const applicationText = toNamed(
        own ?? fallback ?? '',
        definition.variables
    );
    let source: string;
    if (!dictionaries) source = 'Loading the application text…';
    else if (own) source = `Application text: “${applicationText}”`;
    else
        source = `Application text: “${applicationText}”, in English: ${locale} has no translation for it.`;

    const error = value === undefined ? null : slotTemplateError(slot, value);
    const warning =
        value === undefined ? null : slotTemplateWarning(slot, value);
    const helper =
        error ??
        warning ??
        (value === undefined ? source : `Set for ${locale}. ${source}`);

    const insert = (name: string) => {
        const element = input.current;
        const current = value ?? '';
        const start = element?.selectionStart ?? current.length;
        const end = element?.selectionEnd ?? current.length;
        onChange(`${current.slice(0, start)}{${name}}${current.slice(end)}`);
    };

    return (
        <Stack spacing={0.5} data-text-slot={slot}>
            <TextField
                id={id}
                inputRef={input}
                size='small'
                fullWidth
                label={definition.context}
                value={value ?? ''}
                placeholder={applicationText}
                error={Boolean(error)}
                helperText={helper}
                onChange={(event) => onChange(event.target.value)}
            />
            <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                {(definition.variables ?? []).map((name) => (
                    <Button
                        key={name}
                        size='small'
                        variant='outlined'
                        onClick={() => insert(name)}
                    >
                        Insert {`{${name}}`}
                    </Button>
                ))}
                <Button
                    size='small'
                    disabled={value === undefined}
                    onClick={() => onChange(undefined)}
                    aria-label={`Reset “${definition.context}” for ${locale}`}
                >
                    Reset
                </Button>
            </Stack>
        </Stack>
    );
};

/**
 * Memoised: the Studio re-renders on every token and recipe edit, and ten text fields re-rendering
 * with it made every other control measurably slower.
 */
export const TextSlotsEditor = memo(TextSlotsEditorFields);

export default TextSlotsEditor;
