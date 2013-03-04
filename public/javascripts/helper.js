define(['jquery'], function($) {
    function clearForm(form) {
        $(form).find('input').val('');
    }

    return {
        addFormHandler: function(query, url, options) {
            var doReplace = false;
            var useId = false;

            options = options || {};

            if (options.hasOwnProperty('replaceQuery')) {
                doReplace = true;
            }

            if (options.hasOwnProperty('idAttr')) {
                useId = true;
            }

            $(query).livequery('submit', function(evt) {
                if (evt && evt.preventDefault) {
                    evt.preventDefault();
                }

                $(this).find('.form-status').empty();

                var this_ = this;
                var d = {};

                if (useId) {
                    d.id = $(this).attr(options.idAttr);
                }

                var data = $(this).serializeArray().forEach(function(item) {
                    d[item.name] = item.value;
                });

                $.ajax({
                    url: url,
                    data: d,
                    type: 'POST'
                }).done(function(data) {
                    if (data && (data.type === 'error' || data.type === 'success') && data.content) {
                        if (data.type === 'error') {
                            $(this_).find('.form-status').html(data.content);
                        } else if (doReplace) {
                            $(options.replaceQuery).html(data.content);
                            clearForm(this_);
                        } else {
                            $(this_).find('.form-status').html(data.content);
                            clearForm(this_);
                        }
                    }
                });
                return false;
            });
        },

        addTextFieldListener: function(query, idAttr, url, key, dataProcessor) {
            $(query).livequery('change', function(evt) {
                var id = $(this).attr(idAttr);
                var val = $(this).val();
                var this_ = this;
                var data = {
                    id: id
                };

                data[key] = val;

                if (dataProcessor) {
                    data = dataProcessor(data);
                }

                $.ajax({
                    url: url,
                    data: data,
                    type: 'POST'
                });
            });
        },

        addClickListener: function(query, url, options) {
            var doReplace = false;
            var useId = false;
            var customData = false;
            var hasSCallback = false;
            var hasCallbacks = false;

            options = options || {};

            if (options.hasOwnProperty('replaceQuery')) {
                doReplace = true;
            }

            if (options.hasOwnProperty('idAttr')) {
                useId = true;
            }

            if (options.hasOwnProperty('dataProcessor')) {
                customData = true;
            }

            if (options.hasOwnProperty('onSuccess')) {
                hasSCallback = true;
                hasCallbacks = true;
            }

            $(query).livequery('click', function(event) {
                var d = {};

                if (useId) {
                    d.id = $(this).attr(options.idAttr);
                }

                var req = $.ajax({
                    url: url,
                    data: customData ? options.dataProcessor(d, this) : d,
                    type: 'POST'
                });

                if (doReplace || hasCallbacks) {
                    req.done(function(data) {
                        if (data) {
                            if (doReplace && data.content) {
                                $(options.replaceQuery).html(data.content);
                            }

                            if (hasSCallback && data.type === 'success') {
                                options.onSuccess(data.content);
                            }
                        }
                    });
                }
            });
        }
    };
});
