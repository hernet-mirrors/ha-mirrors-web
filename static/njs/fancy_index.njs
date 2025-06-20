// fancy_index.njs - NJS 模块，做目录美化用
// 参考 tuna/mirror-web 的 FancyIndex NJS

/**
 * 简单模板渲染，直接替换 {{key}}
 */
function markUp(template, data) {
    var result = template;
    for (var key in data) {
        if (data.hasOwnProperty(key)) {
            var placeholder = '{{' + key + '}}';
            var value = data[key];
            if (typeof value === 'string') {
                result = result.replace(new RegExp(placeholder, 'g'), value);
            }
        }
    }
    return result;
}

/**
 * 渲染 fancy index 页面
 */
function fancyIndexRender(r, templateUrl) {
    r.subrequest(
        templateUrl,
        {
            args: '',
            body: '',
            method: 'GET'
        },
        function (rTmpl) {
            if (rTmpl.status !== 200) {
                r.return(rTmpl.status);
                return;
            }
            var tmpl = rTmpl.responseText;
            var url = r.variables.request_uri.replace(/\/+/g, '/').replace(/\?.*$/, '');
            var result = markUp(tmpl, {
                url: url
            });
            r.status = 200;
            r.headersOut['Content-Type'] = 'text/html; charset=utf-8';
            r.sendHeader();
            r.send(result);
            r.finish();
        }
    );
}

// 渲染 before.html
function fancyIndexBeforeRender(r) {
    fancyIndexRender(r, '/fancy-index/before.html');
}

// 渲染 after.html
function fancyIndexAfterRender(r) {
    fancyIndexRender(r, '/fancy-index/after.html');
}

// 导出给 nginx 用
export default { 
    fancyIndexBeforeRender, 
    fancyIndexAfterRender
};
