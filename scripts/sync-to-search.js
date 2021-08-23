const crypto = require('crypto');
const algoliasearch = require('algoliasearch');
const createMarkdownIt = require('@mdpress/markdown');
const _slugify = require('@mdpress/shared-utils/lib/slugify');

const md = createMarkdownIt();
const client = algoliasearch('HBKI4H8ZHK', process.env.ALGOLIA_KEY);
const index = client.initIndex('docschina_docs');

function getHeadings(tokens, pointers) {
  return Object.keys(pointers)
    .filter((key) => pointers[key])
    .reduce((pre, heading) => {
      const inlineTokenIndex = pointers[heading].index + 1;

      pre[heading] = {
        text: tokens[inlineTokenIndex].plainText,
        id: pointers[heading].attrGet('id'),
      };
      return pre;
    }, {});
}

function getSearchSegmentFromTokens(
  tokens,
  pointers = {
    h1: null,
    h2: null,
    h3: null,
    h4: null,
    h5: null,
    h6: null,
  }
) {
  let res = [];

  tokens.forEach((token, index) => {
    token.index = index;

    switch (token.type) {
      case 'heading_open':
        pointers[token.tag] = token;
        break;
      case 'inline':
        const segment = getSearchSegmentFromTokens(
          token.children,
          pointers
        ).join('');
        token.plainText = segment;

        res.push({
          content: segment,
          ...getHeadings(tokens, pointers),
        });
        break;
      case 'text':
        res.push(token.content);
        break;
      default:
        break;
    }
  });

  return res;
}

function getAnchor(segment) {
  const headings = ['h6', 'h5', 'h4', 'h3', 'h2', 'h1'];

  for (let i = 0; i < headings.length; i++) {
    const value = segment[headings[i]];
    if (value) {
      return _slugify(value.id || value.text);
    }
  }
}

function getSearchData(doc) {
  const tokens = md.parse(doc.content, { references: [] });

  // transform markdown to multi search items
  const segments = getSearchSegmentFromTokens(tokens);

  const data = segments.map((segment) => {
    const item = {
      hierarchy: {
        lvl0: doc.title,
        lvl1: segment.h1 ? segment.h1.text : null,
        lvl2: segment.h2 ? segment.h2.text : null,
        lvl3: segment.h3 ? segment.h3.text : null,
        lvl4: segment.h4 ? segment.h4.text : null,
        lvl5: segment.h5 ? segment.h5.text : null,
        lvl6: segment.h6 ? segment.h6.text : null,
      },
      type: doc.type,
      content: segment.content,
      url: getUrl(doc.path),
      anchor: getAnchor(segment),
    };
    item.objectID = crypto
      .createHash('md5')
      .update(JSON.stringify(item))
      .digest('hex');
    return item;
  });

  return data;
}

async function syncAlgolia(param) {
  const { addDocs, updateDocs, deleteDocs } = param;

  // console.log('a,u,d',addDocs, updateDocs, deleteDocs);

  addRecordToSearch(addDocs);

  deleteRecordToSearch(deleteDocs);

  updateRecordToSearch(updateDocs);
}

function addRecordToSearch(docs) {
  let data = docs.reduce((res, doc) => {
    return res.concat(getSearchData(doc));
  }, []);
  index.addObjects(data);

  console.info(`add record to search success: ${docs.length} docs`);
}

function deleteRecordToSearch(docs) {
  const facetFilters = docs.map((doc) => `url:${getUrl(doc.path)}`);

  index
    .deleteBy({
      facetFilters,
    })
    .then(() => {
      // done
      console.info(`delete record to search success: ${docs.length} docs`);
    });
}

function updateRecordToSearch(docs) {
  let data = docs.reduce((res, doc) => {
    return res.concat(getSearchData(doc));
  }, []);

  const facetFilters = docs.map((doc) => `url:${getUrl(doc.path)}`);

  // 先删后加
  index
    .deleteBy({
      facetFilters,
    })
    .then(() => {
      // done
      index.addObjects(data);
      console.info(`update record to search success: ${docs.length} docs`);
    });
}

function getUrl(path) {
  return `https://docschina.org/docs/${path}/`;
}

module.exports.getSearchData = getSearchData;
module.exports.syncAlgolia = syncAlgolia;
