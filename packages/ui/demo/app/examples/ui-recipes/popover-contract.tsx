import { css } from 'remix/component'
import { theme, ui } from 'remix/ui'

export default function Example() {
  return () => (
    <div mix={frameCss}>
      <div mix={[ui.popover, staticPopoverCss]}>
        <div mix={stackCss}>
          <p mix={eyebrowCss}>ui.popover</p>
          <p mix={titleCss}>Floating surfaces inherit one default shell.</p>
          <p mix={bodyCss}>
            Menus, listboxes, and future popup-backed controls should start from the same surface
            contract before adding component-specific behavior.
          </p>
        </div>
      </div>
    </div>
  )
}

let frameCss = css({
  width: '100%',
  padding: theme.space.sm,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl2,
})

let staticPopoverCss = css({
  position: 'relative',
  inset: 'auto',
  opacity: 1,
})

let stackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

let eyebrowCss = css({
  margin: 0,
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

let titleCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

let bodyCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})
