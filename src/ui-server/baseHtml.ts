export async function baseHtml(req: Request) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Botanika</title>

    <!-- Preconnect to Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

    <!-- Inter -->
    <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">

    <!-- Material Icons -->
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"/>

    <!-- Highlight.js -->
    <link rel="stylesheet" href="/hljs-apathy.css">

    <!-- Jess -->
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/gh/targoninc/jess-components@0.0.15/src/src/jess-components.css"/>

    <link rel="stylesheet" href="/reset.css">
    <link rel="stylesheet" href="/index.css">
    <link rel="stylesheet" href="/classes.css">
    <script type="module" src="/index.js"></script>
</head>
<body>
<div id="content"></div>
</body>
</html>
`;
}