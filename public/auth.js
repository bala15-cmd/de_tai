const $ = (selector) => document.querySelector(selector);

let mode = 'login';

function notice(message, error = false) {
    const box = $('#auth-notice');

    box.textContent = message;
    box.classList.remove('hidden', 'error');

    if (error) {
        box.classList.add('error');
    }
}

document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
        mode = button.dataset.mode;

        document.querySelectorAll('[data-mode]').forEach((item) => {
            item.classList.toggle('active', item === button);
        });

        $('#name-wrap').classList.toggle(
            'hidden',
            mode !== 'register'
        );

        $('#name').required = mode === 'register';

        $('#submit-auth').textContent =
            mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản';

        $('#password').autocomplete =
            mode === 'login'
                ? 'current-password'
                : 'new-password';
    });
});

$('#auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const form = Object.fromEntries(
        new FormData(event.target)
    );

    try {
        const response = await fetch(`/api/${mode}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify(form)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || 'Không thể thực hiện yêu cầu.'
            );
        }

        notice(data.message + ' Đang chuyển trang...');

        setTimeout(() => {
            location.href =
                data.user.role === 'admin'
                    ? '/admin'
                    : '/';
        }, 650);

    } catch (error) {
        notice(error.message, true);
    }
});