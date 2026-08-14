"""Part 3 — The response, and the list that trips everyone.

`content` is a LIST, not a string. One response can hold a text block, several
tool-use blocks, and thinking blocks. `message.content[0].text` works fine
today and throws the first time Claude calls a tool.

Write the helper once, use it everywhere.

Against src/text.ts, one difference is worth staring at. TypeScript needs a
type predicate to convince the compiler the filter narrowed the type:

    .filter((block): block is Anthropic.TextBlock => block.type === 'text')

Python needs nothing — `block.type == "text"` narrows `block` on its own,
because the SDK models the content blocks as a tagged union and the type
checker follows the tag. The narrowing is the same idea; TypeScript just makes
you say it out loud in this position.
"""

from anthropic.types import Message


def text_from(message: Message) -> str:
    return "\n".join(block.text for block in message.content if block.type == "text")
