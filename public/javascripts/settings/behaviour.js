define(['jquery'], function($) {
    return {
        apply: function() {
            function clearForm(form) {
                $(form).find('input').val('');
            }

            $('.change-password-form').livequery('submit', function(evt) {
                if (evt && evt.preventDefault) {
                    evt.preventDefault();
                }

                $(this).find('.form-status').empty();

                var id = $(this).attr('data-user-id');
                var this_ = this;

                var d = {
                    id: id
                };

                var data = $(this).serializeArray().forEach(function(item) {
                    d[item.name] = item.value;
                });

                $.ajax({
                    url: '/settings/changePassword',
                    data: d,
                    type: 'POST'
                }).done(function(data) {
                    if (data && (data.type === 'error' || data.type === 'success') && data.content) {
                        $(this_).find('.form-status').html(data.content);
                        clearForm(this_);
                    }
                });
                return false;
            });

            $('.add-user-form').livequery('submit', function(evt) {
                if (evt && evt.preventDefault) {
                    evt.preventDefault();
                }

                $(this).find('.form-status').empty();

                var d = {};
                var data = $(this).serializeArray().forEach(function(item) {
                    d[item.name] = item.value;
                });
                var this_ = this;

                $.ajax({
                    url: '/settings/addUser',
                    data: d,
                    type: 'POST'
                }).done(function(data) {
                    if (data && (data.type === 'error' || data.type === 'success') && data.content) {
                        if (data.type === 'error') {
                            $(this_).find('.form-status').html(data.content);
                        } else {
                            clearForm(this_);
                            $('.user-list').html(data.content);
                        }
                    }
                });
                return false;
            });

            $('.userlist-isAdmin').livequery('click', function(evt) {
                var id = $(this).attr('data-user-id');
                var val = $(this).is(':checked');
                $.ajax({
                    url: '/settings/setAdmin',
                    data: { id: id, isAdmin: val },
                    type: 'POST'
                });
            });

            $('.userlist-password').livequery('change', function(evt) {
                var id = $(this).attr('data-user-id');
                var val = $(this).val();
                var this_ = this;
                $.ajax({
                    url: '/settings/changePassword',
                    data: { id: id, password: val, passwordRepeat: val },
                    type: 'POST'
                });
            });

            $('.userlist-delete').livequery('click', function(evt) {
                var id = $(this).attr('data-user-id');
                var this_ = this;
                $.ajax({
                    url: '/settings/delUser',
                    data: { id: id },
                    type: 'POST'
                }).done(function(data) {
                    if (data && data.type === 'success' && data.content) {
                        $('.user-list').html(data.content);
                    }
                });
            });
        }
    };
});
