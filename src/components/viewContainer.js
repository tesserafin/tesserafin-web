import { debug } from 'utils/debug';

import { importModule } from '@uupaa/dynamic-import-polyfill';
// Used below for $(view).appendTo(...) - no longer implicitly loaded via lib/legacy.
import 'jquery';
import './viewManager/viewContainer.scss';

const getMainAnimatedPages = () => {
    return document.querySelector('.mainAnimatedPages');
};

export function loadView(options) {
    if (!options.cancel) {
        const selected = selectedPageIndex;
        const previousAnimatable = selected === -1 ? null : allPages[selected];
        let pageIndex = selected + 1;

        if (pageIndex >= pageContainerCount) {
            pageIndex = 0;
        }

        const newViewInfo = normalizeNewView(options);
        const newView = newViewInfo.elem;

        const currentPage = allPages[pageIndex];

        if (currentPage) {
            triggerDestroy(currentPage);
        }

        let view = newView;

        if (typeof view == 'string') {
            view = document.createElement('div');
            view.innerHTML = newView;
        }

        view.classList.add('mainAnimatedPage');

        const mainAnimatedPages = getMainAnimatedPages();

        if (!mainAnimatedPages) {
            console.warn(
                '[viewContainer] main animated pages element is not present'
            );
            return;
        }

        if (currentPage) {
            if (newViewInfo.hasScript && window.$) {
                mainAnimatedPages.removeChild(currentPage);
                view = $(view).appendTo(mainAnimatedPages)[0];
            } else {
                mainAnimatedPages.replaceChild(view, currentPage);
            }
        } else if (newViewInfo.hasScript && window.$) {
            view = $(view).appendTo(mainAnimatedPages)[0];
        } else {
            mainAnimatedPages.appendChild(view);
        }

        if (options.type) {
            view.setAttribute('data-type', options.type);
        }

        const properties = [];

        if (options.fullscreen) {
            properties.push('fullscreen');
        }

        if (properties.length) {
            view.setAttribute('data-properties', properties.join(','));
        }

        allPages[pageIndex] = view;

        return (
            // Timeout for polyfilled CustomElements (webOS 1.2)
            new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
                if (onBeforeChange) {
                    onBeforeChange(view, false, options);
                }

                beforeAnimate(allPages, pageIndex, selected);
                selectedPageIndex = pageIndex;
                currentUrls[pageIndex] = options.url;

                if (!options.cancel && previousAnimatable) {
                    afterAnimate(allPages, pageIndex);
                }

                if (window.$) {
                    $.mobile = $.mobile || {};
                    $.mobile.activePage = view;
                }

                return view;
            })
        );
    }
}

function parseHtml(html, hasScript) {
    if (hasScript) {
        html = html
            .replaceAll('\x3c!--<script', '<script')
            .replaceAll('</script>--\x3e', '</script>');
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    return wrapper.querySelector('div[data-role="page"]');
}

function normalizeNewView(options) {
    const viewHtml = options.view;

    if (viewHtml.indexOf('data-role="page"') === -1) {
        return viewHtml;
    }

    let hasScript = viewHtml.indexOf('<script') !== -1;
    const elem = parseHtml(viewHtml, hasScript);

    if (hasScript) {
        hasScript = elem.querySelector('script') != null;
    }

    return {
        elem: elem,
        hasScript: hasScript
    };
}

function beforeAnimate(allPages, newPageIndex, oldPageIndex) {
    for (let index = 0, length = allPages.length; index < length; index++) {
        if (newPageIndex !== index && oldPageIndex !== index) {
            allPages[index].classList.add('hide');
        }
    }
}

function afterAnimate(allPages, newPageIndex) {
    for (let index = 0, length = allPages.length; index < length; index++) {
        if (newPageIndex !== index) {
            allPages[index].classList.add('hide');
        }
    }
}

export function setOnBeforeChange(fn) {
    onBeforeChange = fn;
}

export function tryRestoreView(options) {
    debug('[viewContainer] tryRestoreView');
    const url = options.url;
    const index = currentUrls.indexOf(url);

    if (index !== -1) {
        const animatable = allPages[index];
        const view = animatable;

        if (view) {
            if (options.cancel) {
                return;
            }

            const selected = selectedPageIndex;
            const previousAnimatable =
                selected === -1 ? null : allPages[selected];
            return Promise.resolve().then(() => {
                if (onBeforeChange) {
                    onBeforeChange(view, true, options);
                }

                beforeAnimate(allPages, index, selected);
                animatable.classList.remove('hide');
                selectedPageIndex = index;

                if (!options.cancel && previousAnimatable) {
                    afterAnimate(allPages, index);
                }

                if (window.$) {
                    $.mobile = $.mobile || {};
                    $.mobile.activePage = view;
                }

                return view;
            });
        }
    }

    return Promise.reject();
}

function triggerDestroy(view) {
    view.dispatchEvent(new CustomEvent('viewdestroy', {}));
}

export function reset() {
    debug('[viewContainer] resetting view cache');
    allPages = [];
    currentUrls = [];
    const mainAnimatedPages = getMainAnimatedPages();
    if (mainAnimatedPages) mainAnimatedPages.innerHTML = '';
    selectedPageIndex = -1;
}

let onBeforeChange;
let allPages = [];
let currentUrls = [];
const pageContainerCount = 3;
let selectedPageIndex = -1;
reset();
getMainAnimatedPages()?.classList.remove('hide');

export default {
    loadView,
    tryRestoreView,
    reset,
    setOnBeforeChange
};
